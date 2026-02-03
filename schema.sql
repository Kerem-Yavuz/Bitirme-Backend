CREATE DATABASE IF NOT EXISTS bitirme;
USE bitirme;

CREATE TABLE IF NOT EXISTS departments (
    departmentID INT AUTO_INCREMENT PRIMARY KEY,
    departmentName CHAR(255)
);

CREATE TABLE IF NOT EXISTS users (
    userID INT AUTO_INCREMENT PRIMARY KEY,
    password VARCHAR(255),
    active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS userDetails (
    userID INT PRIMARY KEY,
    fullName VARCHAR(255),
    phoneNo VARCHAR(255),
    email VARCHAR(255),
    departmentID INT,
    FOREIGN KEY (userID) REFERENCES users(userID) ON DELETE CASCADE,
    FOREIGN KEY (departmentID) REFERENCES departments(departmentID)
);

CREATE TABLE IF NOT EXISTS privileges (
    privilegeID INT AUTO_INCREMENT PRIMARY KEY,
    privilegeName VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS user_privileges (
    userID INT,
    privID INT,
    PRIMARY KEY (userID, privID),
    FOREIGN KEY (userID) REFERENCES users(userID) ON DELETE CASCADE,
    FOREIGN KEY (privID) REFERENCES privileges(privilegeID) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lessons (
    lessonID INT AUTO_INCREMENT PRIMARY KEY,
    lessonName CHAR(255),
    lessonTeacherID INT,
    departmentID INT,
    semesterNo INT,
    FOREIGN KEY (departmentID) REFERENCES departments(departmentID)
);

CREATE TABLE IF NOT EXISTS lesson_groups (
    lessonGroupID INT AUTO_INCREMENT PRIMARY KEY,
    lessonGroupName CHAR(255),
    lessonID INT,
    FOREIGN KEY (lessonID) REFERENCES lessons(lessonID) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lesson_group_details (
    lessonGroupID INT PRIMARY KEY,
    maxNumber INT,
    lessonDesc TEXT,
    hour TIME,
    day INT,
    FOREIGN KEY (lessonGroupID) REFERENCES lesson_groups(lessonGroupID) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS prerequisite (
    prerequisiteConnectionID INT AUTO_INCREMENT PRIMARY KEY,
    prerequisiteLessonID INT,
    subsequentLessonID INT,
    FOREIGN KEY (prerequisiteLessonID) REFERENCES lessons(lessonID) ON DELETE CASCADE,
    FOREIGN KEY (subsequentLessonID) REFERENCES lessons(lessonID) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_lesson_groups (
    userLessonGroupID INT AUTO_INCREMENT PRIMARY KEY,
    lessonGroupID INT,
    userID INT,
    grade CHAR(5),
    FOREIGN KEY (lessonGroupID) REFERENCES lesson_groups(lessonGroupID) ON DELETE CASCADE,
    FOREIGN KEY (userID) REFERENCES users(userID) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    userID INT PRIMARY KEY,
    token VARCHAR(255),
    expires_at DATETIME,
    isRevoked BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (userID) REFERENCES users(userID) ON DELETE CASCADE
);
