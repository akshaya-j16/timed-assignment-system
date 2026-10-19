
-- 1. Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(10) NOT NULL
        CHECK (role IN ('student', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Assignments table
CREATE TABLE assignments (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    time_limit_minutes INTEGER NOT NULL
        CHECK (time_limit_minutes > 0),
    created_by INTEGER NOT NULL
        REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Attempts table
CREATE TABLE attempts (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL
        REFERENCES users(id),
    assignment_id INTEGER NOT NULL
        REFERENCES assignments(id),

    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deadline TIMESTAMPTZ NOT NULL,
    submitted_at TIMESTAMPTZ,

    answer TEXT,
    link_url TEXT,

    answer_not_empty BOOLEAN,
    link_is_valid BOOLEAN,
    answer_long_enough BOOLEAN,

    score INTEGER CHECK (score BETWEEN 0 AND 3),

    status VARCHAR(20) NOT NULL DEFAULT 'in_progress'
        CHECK (status IN (
            'in_progress',
            'submitted',
            'reviewed',
            'timed_out'
        ))
);

-- Useful indexes for finding attempts
CREATE INDEX idx_attempts_student
    ON attempts(student_id);

CREATE INDEX idx_attempts_assignment
    ON attempts(assignment_id);
