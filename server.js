const express = require("express");
const pool = require("./db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const {
    authenticateToken,
    requireAdmin
} = require("./middleware/auth");
const app = express();

app.use(express.json());

app.get("/", (req, res) => {
    res.send("Timed Assignment System Backend is running!");
});

app.get("/db-test", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT current_database() AS database"
        );

        res.json({
            status: "success",
            message: "Database connected successfully",
            database: result.rows[0].database
        });
    } catch (error) {
        console.error("Database connection failed:", error.message);

        res.status(500).json({
            status: "error",
            message: "Database connection failed"
        });
    }
});


app.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // 1. Validate required fields
        if (!name || !email || !password) {
            return res.status(400).json({
                message: "Name, email, and password are required"
            });
        }

        // 2. Validate basic email format
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailPattern.test(email)) {
            return res.status(400).json({
                message: "Please provide a valid email"
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                message: "Password must be at least 8 characters"
            });
        }

        // 3. Hash the password
        const passwordHash = await bcrypt.hash(password, 10);

        // 4. Save the student in PostgreSQL
        const result = await pool.query(
            `INSERT INTO users (name, email, password_hash, role)
             VALUES ($1, $2, $3, $4)
             RETURNING id, name, email, role`,
            [
                name.trim(),
                email.trim().toLowerCase(),
                passwordHash,
                "student"
            ]
        );

        // 5. Return the created student
        return res.status(201).json({
            message: "Registration successful",
            user: result.rows[0]
        });

    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({
                message: "Email is already registered"
            });
        }

        console.error("Registration error:", error.message);

        return res.status(500).json({
            message: "Internal server error"
        });
    }
});

app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        const result = await pool.query(
            `SELECT id, name, email, password_hash, role
             FROM users
             WHERE email = $1`,
            [email.trim().toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const user = result.rows[0];

        const passwordMatches = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatches) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const token = jwt.sign(
            {
                userId: user.id,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        return res.json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Login error:", error.message);

        return res.status(500).json({
            message: "Internal server error"
        });
    }
});

app.get("/profile", authenticateToken, (req, res) => {
    res.json({
        message: "You are authenticated",
        userId: req.user.userId,
        role: req.user.role
    });
});


/* Admin creates an assignment */
app.post(
    "/assignments",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { title, description, time_limit_minutes } = req.body;

            if (
                typeof title !== "string" || !title.trim() ||
                typeof description !== "string" || !description.trim() ||
                !Number.isInteger(time_limit_minutes) ||
                time_limit_minutes <= 0
            ) {
                return res.status(400).json({
                    message: "Provide a title, description, and positive integer time limit"
                });
            }

            const result = await pool.query(
                `INSERT INTO assignments
                    (title, description, time_limit_minutes, created_by)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, title, description, time_limit_minutes, created_by`,
                [
                    title.trim(),
                    description.trim(),
                    time_limit_minutes,
                    req.user.userId
                ]
            );

            return res.status(201).json({
                message: "Assignment created successfully",
                assignment: result.rows[0]
            });
        } catch (error) {
            console.error("Create assignment error:", error.message);
            return res.status(500).json({
                message: "Internal server error"
            });
        }
    }
);

/* Logged-in users can list assignments */
app.get(
    "/assignments",
    authenticateToken,
    async (req, res) => {
        try {
            const result = await pool.query(
                `SELECT id, title, description, time_limit_minutes, created_at
                 FROM assignments
                 ORDER BY id DESC`
            );

            return res.json({
                assignments: result.rows
            });
        } catch (error) {
            console.error("List assignments error:", error.message);
            return res.status(500).json({
                message: "Internal server error"
            });
        }
    }
);


app.post(
    "/assignments/:id/start",
    authenticateToken,
    async (req, res) => {
        try {
            // Only students can start attempts
            if (req.user.role !== "student") {
                return res.status(403).json({
                    message: "Only students can start assignments"
                });
            }

            const assignmentId = Number(req.params.id);

            if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
                return res.status(400).json({
                    message: "Invalid assignment ID"
                });
            }

            // Find the assignment
            const assignmentResult = await pool.query(
                `SELECT id, title, time_limit_minutes
                 FROM assignments
                 WHERE id = $1`,
                [assignmentId]
            );

            if (assignmentResult.rows.length === 0) {
                return res.status(404).json({
                    message: "Assignment not found"
                });
            }

            const assignment = assignmentResult.rows[0];

            // Record start time and deadline using database time
            const attemptResult = await pool.query(
                `INSERT INTO attempts
                    (student_id, assignment_id, started_at, deadline, status)
                 VALUES (
                    $1, $2, NOW(),
                    NOW() + ($3 * INTERVAL '1 minute'),
                    'in_progress'
                 )
                 RETURNING id, assignment_id, started_at, deadline, status`,
                [
                    req.user.userId,
                    assignment.id,
                    assignment.time_limit_minutes
                ]
            );

            return res.status(201).json({
                message: "Assignment started successfully",
                attempt: attemptResult.rows[0]
            });
        } catch (error) {
            console.error("Start assignment error:", error.message);

            return res.status(500).json({
                message: "Internal server error"
            });
        }
    }
);


app.post(
    "/attempts/:id/submit",
    authenticateToken,
    async (req, res) => {
        try {
            if (req.user.role !== "student") {
                return res.status(403).json({
                    message: "Only students can submit answers"
                });
            }

            const attemptId = Number(req.params.id);

            if (!Number.isInteger(attemptId) || attemptId <= 0) {
                return res.status(400).json({
                    message: "Invalid attempt ID"
                });
            }

            if (
                !req.body ||
                typeof req.body.answer !== "string" ||
                typeof req.body.link !== "string"
            ) {
                return res.status(400).json({
                    message: "Answer and link fields are required"
                });
            }

            const { answer, link } = req.body;

            // Fetch only this student's attempt
            const result = await pool.query(
                `SELECT id, deadline, status
                 FROM attempts
                 WHERE id = $1 AND student_id = $2`,
                [attemptId, req.user.userId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message: "Attempt not found"
                });
            }

            const attempt = result.rows[0];

            if (attempt.status !== "in_progress") {
                return res.status(409).json({
                    message: "This attempt is no longer in progress"
                });
            }

            // Enforce deadline using the database clock
            const deadlineResult = await pool.query(
                `SELECT NOW() > $1::timestamptz AS is_late`,
                [attempt.deadline]
            );

            if (deadlineResult.rows[0].is_late) {
                await pool.query(
                    `UPDATE attempts
                     SET status = 'timed_out'
                     WHERE id = $1 AND status = 'in_progress'`,
                    [attemptId]
                );

                return res.status(400).json({
                    message: "Deadline passed. Attempt timed out."
                });
            }

            const answerText =
                typeof answer === "string" ? answer.trim() : "";

            const linkText =
                typeof link === "string" ? link.trim() : "";

            let linkIsValid = false;

            try {
                const parsedUrl = new URL(linkText);
                linkIsValid =
                    parsedUrl.protocol === "http:" ||
                    parsedUrl.protocol === "https:";
            } catch {
                linkIsValid = false;
            }

            const answerNotEmpty = answerText.length > 0;
            const answerLongEnough = answerText.length >= 50;

            const score = [
                answerNotEmpty,
                linkIsValid,
                answerLongEnough
            ].filter(Boolean).length;

            // Atomically accept only one submission before the deadline
            const submission = await pool.query(
                `UPDATE attempts
                 SET answer = $1,
                     link_url = $2,
                     answer_not_empty = $3,
                     link_is_valid = $4,
                     answer_long_enough = $5,
                     score = $6,
                     submitted_at = NOW(),
                     status = 'submitted'
                 WHERE id = $7
                   AND student_id = $8
                   AND status = 'in_progress'
                   AND deadline >= NOW()
                 RETURNING id, answer_not_empty, link_is_valid,
                           answer_long_enough, score, submitted_at, status`,
                [
                    answerText,
                    linkText,
                    answerNotEmpty,
                    linkIsValid,
                    answerLongEnough,
                    score,
                    attemptId,
                    req.user.userId
                ]
            );

            if (submission.rows.length === 0) {
                const current = await pool.query(
                    `UPDATE attempts
                     SET status = 'timed_out'
                     WHERE id = $1
                       AND student_id = $2
                       AND status = 'in_progress'
                       AND deadline < NOW()
                     RETURNING id`,
                    [attemptId, req.user.userId]
                );

                if (current.rows.length > 0) {
                    return res.status(400).json({
                        message: "Deadline passed. Attempt timed out."
                    });
                }

                return res.status(409).json({
                    message: "Attempt already submitted or no longer active"
                });
            }

            return res.json({
                message: "Answer submitted successfully",
                result: submission.rows[0]
            });

        } catch (error) {
            console.error("Submit answer error:", error.message);

            return res.status(500).json({
                message: "Internal server error"
            });
        }
    }
);

const PORT = 3000;

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
