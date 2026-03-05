-- ===================================================
-- Bitirme Projesi - Test Seed Verileri
-- Çalıştırmadan önce schema.sql çalıştırılmış olmalı!
-- Şifre: Tüm kullanıcılar için "123456"
-- ===================================================

USE bitirme;

-- =====================
-- 1. BÖLÜMLER
-- =====================
INSERT INTO departments (departmentName) VALUES
('Bilgisayar Mühendisliği'),
('Yazılım Mühendisliği');

-- =====================
-- 2. YETKİLER
-- =====================
INSERT INTO privileges (privilegeName) VALUES
('Admin'),
('Student'),
('Teacher');

-- =====================
-- 3. KULLANICILAR
-- Şifre: 123456
-- Hash: node -e "const bcrypt = require('bcrypt'); bcrypt.hash('123456', 10, (err, h) => console.log(h));"
-- =====================
INSERT INTO users (password, active) VALUES
('$2b$10$S6ysaLRN6W/hmCg0VVot0uMOwDltexfeqEHGV5.BjxWGCOucEsAbC', true),  -- userID 1: Admin
('$2b$10$S6ysaLRN6W/hmCg0VVot0uMOwDltexfeqEHGV5.BjxWGCOucEsAbC', true),  -- userID 2: Öğrenci 1
('$2b$10$S6ysaLRN6W/hmCg0VVot0uMOwDltexfeqEHGV5.BjxWGCOucEsAbC', true),  -- userID 3: Öğrenci 2
('$2b$10$S6ysaLRN6W/hmCg0VVot0uMOwDltexfeqEHGV5.BjxWGCOucEsAbC', true);  -- userID 4: Teacher

-- =====================
-- 4. KULLANICI DETAYLARI
-- =====================
INSERT INTO userDetails (userID, fullName, phoneNo, email, departmentID) VALUES
(1, 'Admin Kullanıcı', '0555-111-1111', 'admin@bitirme.com', 1),
(2, 'Ahmet Yılmaz', '0555-222-2222', 'ahmet@bitirme.com', 1),
(3, 'Elif Demir', '0555-333-3333', 'elif@bitirme.com', 2),
(4, 'Dr. Mehmet Kaya', '0555-444-4444', 'mehmet@bitirme.com', 1);

-- =====================
-- 5. KULLANICI YETKİLERİ
-- =====================
INSERT INTO user_privileges (userID, privID) VALUES
(1, 1),  -- Admin -> Admin yetkisi
(2, 2),  -- Ahmet -> Student yetkisi
(3, 2),  -- Elif  -> Student yetkisi
(4, 3);  -- Mehmet -> Teacher yetkisi

-- =====================
-- 6. DERSLER
-- =====================
-- Bilgisayar Mühendisliği - 1. Dönem
INSERT INTO lessons (lessonName, lessonTeacherID, departmentID, semesterNo) VALUES
('BİM 101 - Programlamaya Giriş', 4, 1, 1),
('MAT 101 - Matematik I', 4, 1, 1),
('FİZ 101 - Fizik I', 1, 1, 1);

-- Bilgisayar Mühendisliği - 2. Dönem
INSERT INTO lessons (lessonName, lessonTeacherID, departmentID, semesterNo) VALUES
('BİM 102 - Veri Yapıları', 4, 1, 2),
('MAT 102 - Matematik II', 1, 1, 2);

-- Yazılım Mühendisliği - 1. Dönem
INSERT INTO lessons (lessonName, lessonTeacherID, departmentID, semesterNo) VALUES
('EEM 101 - Devre Analizi', 1, 2, 1);

-- =====================
-- 7. DERS GRUPLARI
-- =====================
-- BİM 101 grupları (lessonID = 1)
INSERT INTO lesson_groups (lessonGroupName, lessonID, maxNumber) VALUES
('A Grubu', 1, 40),
('B Grubu', 1, 40);

-- MAT 101 grupları (lessonID = 2)
INSERT INTO lesson_groups (lessonGroupName, lessonID, maxNumber) VALUES
('Tek Grup', 2, 60);

-- FİZ 101 grupları (lessonID = 3)
INSERT INTO lesson_groups (lessonGroupName, lessonID, maxNumber) VALUES
('A Grubu', 3, 35),
('B Grubu', 3, 35);

-- BİM 102 grupları (lessonID = 4)
INSERT INTO lesson_groups (lessonGroupName, lessonID, maxNumber) VALUES
('Tek Grup', 4, 45);

-- MAT 102 grupları (lessonID = 5)
INSERT INTO lesson_groups (lessonGroupName, lessonID, maxNumber) VALUES
('A Grubu', 5, 50),
('B Grubu', 5, 50);

-- EEM 101 grupları (lessonID = 6)
INSERT INTO lesson_groups (lessonGroupName, lessonID, maxNumber) VALUES
('Tek Grup', 6, 30);

-- =====================
-- 8. DERS GRUBU SAATLERİ
-- day: 1=Pazartesi, 2=Salı, 3=Çarşamba, 4=Perşembe, 5=Cuma
-- hour: Gerçek başlangıç saati (09:00:00, 10:00:00, vb.)
-- =====================

-- BİM 101 - A Grubu (lessonGroupID=1): Pazartesi 09-12 (3 saat)
INSERT INTO lesson_group_hours (lessonGroupID, hour, day, room) VALUES
(1, '09:00:00', 1, 'B-101'),
(1, '10:00:00', 1, 'B-101'),
(1, '11:00:00', 1, 'B-101');

-- BİM 101 - B Grubu (lessonGroupID=2): Salı 09-12 (3 saat)
INSERT INTO lesson_group_hours (lessonGroupID, hour, day, room) VALUES
(2, '09:00:00', 2, 'B-102'),
(2, '10:00:00', 2, 'B-102'),
(2, '11:00:00', 2, 'B-102');

-- MAT 101 - Tek Grup (lessonGroupID=3): Çarşamba 09-11 (2 saat)
INSERT INTO lesson_group_hours (lessonGroupID, hour, day, room) VALUES
(3, '09:00:00', 3, 'Amfi A-1'),
(3, '10:00:00', 3, 'Amfi A-1');

-- FİZ 101 - A Grubu (lessonGroupID=4): Perşembe 11-13 (2 saat)
INSERT INTO lesson_group_hours (lessonGroupID, hour, day, room) VALUES
(4, '11:00:00', 4, 'Lab F-201'),
(4, '12:00:00', 4, 'Lab F-201');

-- FİZ 101 - B Grubu (lessonGroupID=5): Perşembe 13-15 (2 saat)
INSERT INTO lesson_group_hours (lessonGroupID, hour, day, room) VALUES
(5, '13:00:00', 4, 'Lab F-202'),
(5, '14:00:00', 4, 'Lab F-202');

-- BİM 102 - Tek Grup (lessonGroupID=6): Cuma 10-13 (3 saat)
INSERT INTO lesson_group_hours (lessonGroupID, hour, day, room) VALUES
(6, '10:00:00', 5, 'B-201'),
(6, '11:00:00', 5, 'B-201'),
(6, '12:00:00', 5, 'B-201');

-- MAT 102 - A Grubu (lessonGroupID=7): Pazartesi 13-15 (2 saat)
INSERT INTO lesson_group_hours (lessonGroupID, hour, day, room) VALUES
(7, '13:00:00', 1, 'Amfi A-2'),
(7, '14:00:00', 1, 'Amfi A-2');

-- MAT 102 - B Grubu (lessonGroupID=8): Pazartesi 15-17 (2 saat)
INSERT INTO lesson_group_hours (lessonGroupID, hour, day, room) VALUES
(8, '15:00:00', 1, 'Amfi A-3'),
(8, '16:00:00', 1, 'Amfi A-3');

-- EEM 101 - Tek Grup (lessonGroupID=9): Salı 13-16 (3 saat)
INSERT INTO lesson_group_hours (lessonGroupID, hour, day, room) VALUES
(9, '13:00:00', 2, 'Lab E-101'),
(9, '14:00:00', 2, 'Lab E-101'),
(9, '15:00:00', 2, 'Lab E-101');

-- =====================
-- 9. ÖN KOŞULLAR
-- =====================
INSERT INTO prerequisite (prerequisiteLessonID, subsequentLessonID) VALUES
(1, 4),  -- BİM 102 için ön koşul: BİM 101
(2, 5);  -- MAT 102 için ön koşul: MAT 101

-- =====================
-- 10. ÖĞRENCİ DERS KAYITLARI
-- =====================
-- Ahmet (userID=2): BİM 101 A Grubu, MAT 101 Tek Grup, FİZ 101 A Grubu
INSERT INTO user_lesson_groups (lessonGroupID, userID, grade) VALUES
(1, 2, 'PEND'),
(3, 2, 'PEND'),
(4, 2, 'PEND');

-- Elif (userID=3): EEM 101 Tek Grup
INSERT INTO user_lesson_groups (lessonGroupID, userID, grade) VALUES
(9, 3, 'PEND');
