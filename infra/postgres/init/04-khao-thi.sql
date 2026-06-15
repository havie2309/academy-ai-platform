-- ============================================
-- KHAO THI / EXAM & SURVEY TABLES
-- ============================================

CREATE TABLE exam_frameworks (
    id VARCHAR(20) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    time_minutes INTEGER CHECK (time_minutes > 0),
    mon_hoc_id VARCHAR(20) REFERENCES mon_hoc(id) ON DELETE SET NULL,
    active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE exam_matrices (
    id VARCHAR(20) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    exam_framework_id VARCHAR(20) REFERENCES exam_frameworks(id) ON DELETE CASCADE,
    active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE knowledge_blocks (
    id VARCHAR(20) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    mon_hoc_id VARCHAR(20) REFERENCES mon_hoc(id) ON DELETE SET NULL,
    active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE question_banks (
    id VARCHAR(20) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    mon_hoc_id VARCHAR(20) REFERENCES mon_hoc(id) ON DELETE SET NULL,
    active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE questions (
    id VARCHAR(20) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(30) NOT NULL CHECK (type IN ('single_choice', 'multiple_choice', 'true_false', 'essay', 'fill_blank')),
    difficult VARCHAR(20) CHECK (difficult IN ('easy', 'medium', 'hard')),
    explanation TEXT,
    question_bank_id VARCHAR(20) REFERENCES question_banks(id) ON DELETE CASCADE,
    knowledge_block_id VARCHAR(20) REFERENCES knowledge_blocks(id) ON DELETE SET NULL,
    active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE question_options (
    id VARCHAR(20) PRIMARY KEY,
    question_id VARCHAR(20) REFERENCES questions(id) ON DELETE CASCADE,
    option_label VARCHAR(5),
    content TEXT NOT NULL,
    is_correct BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE exam_banks (
    id VARCHAR(20) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    exam_code VARCHAR(50),
    description TEXT,
    exam_time INTEGER CHECK (exam_time > 0),
    explain TEXT,
    exam_day TIMESTAMP,
    is_note BOOLEAN DEFAULT FALSE,
    hoc_ky_id VARCHAR(20) REFERENCES hoc_ky(id) ON DELETE SET NULL,
    lop_hoc_phan_id VARCHAR(20) REFERENCES lop_hoc_phan(id) ON DELETE SET NULL,
    exam_matrix_id VARCHAR(20) REFERENCES exam_matrices(id) ON DELETE SET NULL,
    active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE exam_bank_questions (
    exam_bank_id VARCHAR(20) REFERENCES exam_banks(id) ON DELETE CASCADE,
    question_id VARCHAR(20) REFERENCES questions(id) ON DELETE CASCADE,
    question_order INTEGER,
    points DECIMAL(5,2) DEFAULT 1.00,
    PRIMARY KEY (exam_bank_id, question_id)
);

CREATE TABLE survey_topics (
    id VARCHAR(20) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(30) CHECK (type IN ('course_feedback', 'lecturer_feedback', 'service_feedback', 'general')),
    description TEXT,
    active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE cluster_surveys (
    id VARCHAR(20) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    survey_topic_id VARCHAR(20) REFERENCES survey_topics(id) ON DELETE CASCADE,
    active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE survey_object_types (
    id VARCHAR(20) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    training_object_type_code VARCHAR(50),
    active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE survey_question_groups (
    id VARCHAR(20) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE survey_questions (
    id VARCHAR(20) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name TEXT NOT NULL,
    type VARCHAR(30) CHECK (type IN ('rating', 'single_choice', 'multiple_choice', 'text')),
    description TEXT,
    survey_question_group_id VARCHAR(20) REFERENCES survey_question_groups(id) ON DELETE CASCADE,
    active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE surveys (
    id VARCHAR(20) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    is_public BOOLEAN DEFAULT FALSE,
    anonymous BOOLEAN DEFAULT FALSE,
    survey_topic_id VARCHAR(20) REFERENCES survey_topics(id) ON DELETE SET NULL,
    cluster_survey_id VARCHAR(20) REFERENCES cluster_surveys(id) ON DELETE SET NULL,
    survey_object_type_id VARCHAR(20) REFERENCES survey_object_types(id) ON DELETE SET NULL,
    active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE survey_sessions (
    id VARCHAR(20) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    survey_id VARCHAR(20) REFERENCES surveys(id) ON DELETE CASCADE,
    user_id VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL,
    hoc_vien_id VARCHAR(20) REFERENCES hoc_vien(id) ON DELETE SET NULL,
    survey_object_type_id VARCHAR(20) REFERENCES survey_object_types(id) ON DELETE SET NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    description TEXT,
    active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE survey_answers (
    id SERIAL PRIMARY KEY,
    survey_session_id VARCHAR(20) REFERENCES survey_sessions(id) ON DELETE CASCADE,
    survey_question_id VARCHAR(20) REFERENCES survey_questions(id) ON DELETE CASCADE,
    rating_value INTEGER CHECK (rating_value BETWEEN 1 AND 5),
    choice_value TEXT,
    text_value TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (survey_session_id, survey_question_id)
);
