-- ============================================================
-- Courtly Demo Seed Data
-- MERGE INTO = H2 upsert: safe to run on every backend startup.
-- Seed passwords are automatically migrated to BCrypt by PasswordHashMigration.
--
-- Column name note: Hibernate's SpringPhysicalNamingStrategy maps
--   userID    → userid    (consecutive uppercase kept together)
--   courtID   → courtid
--   bookingID → bookingid
--   playerID  → playerid
--   ratingID  → ratingid
--   managerId → manager_id  (mixed case splits normally)
-- ============================================================

-- ── ARENA MANAGERS ───────────────────────────────────────────

MERGE INTO app_users (userid, name, email, password_hash, role, account_status,
    session_token, phone, date_of_birth, deletion_status, deletion_requested_at,
    otp_code, otp_expiry, created_at)
KEY(userid)
VALUES ('MGR001','Imran Tariq','imran.tariq@demo.com','Demo1234','MANAGER','APPROVED',
    NULL,'0300-1234567','1985-06-15',NULL,NULL,NULL,NULL,'2026-03-01 10:00:00');

MERGE INTO player (userid, discount_tier, rank_points) KEY(userid)
VALUES ('MGR001', NULL, 0);

MERGE INTO app_users (userid, name, email, password_hash, role, account_status,
    session_token, phone, date_of_birth, deletion_status, deletion_requested_at,
    otp_code, otp_expiry, created_at)
KEY(userid)
VALUES ('MGR002','Faisal Mehmood','faisal.mehmood@demo.com','Demo1234','MANAGER','APPROVED',
    NULL,'0321-9876543','1979-11-03',NULL,NULL,NULL,NULL,'2026-03-01 10:00:00');

MERGE INTO player (userid, discount_tier, rank_points) KEY(userid)
VALUES ('MGR002', NULL, 0);

-- ── PLAYERS ──────────────────────────────────────────────────

-- No discount
MERGE INTO app_users (userid, name, email, password_hash, role, account_status,
    session_token, phone, date_of_birth, deletion_status, deletion_requested_at,
    otp_code, otp_expiry, created_at)
KEY(userid)
VALUES ('PLR001','Hamza Raza','hamza.raza@demo.com','Demo1234','PLAYER','APPROVED',
    NULL,'0312-1111111','1998-03-22',NULL,NULL,NULL,NULL,'2026-03-05 09:00:00');
MERGE INTO player (userid, discount_tier, rank_points) KEY(userid)
VALUES ('PLR001', NULL, 0);

MERGE INTO app_users (userid, name, email, password_hash, role, account_status,
    session_token, phone, date_of_birth, deletion_status, deletion_requested_at,
    otp_code, otp_expiry, created_at)
KEY(userid)
VALUES ('PLR002','Zainab Akhtar','zainab.akhtar@demo.com','Demo1234','PLAYER','APPROVED',
    NULL,'0333-2222222','2000-07-14',NULL,NULL,NULL,NULL,'2026-03-06 11:00:00');
MERGE INTO player (userid, discount_tier, rank_points) KEY(userid)
VALUES ('PLR002', NULL, 0);

-- Student discount (20%)
MERGE INTO app_users (userid, name, email, password_hash, role, account_status,
    session_token, phone, date_of_birth, deletion_status, deletion_requested_at,
    otp_code, otp_expiry, created_at)
KEY(userid)
VALUES ('PLR003','Bilal Chaudhry','bilal.chaudhry@demo.com','Demo1234','PLAYER','APPROVED',
    NULL,'0345-3333333','2003-01-09',NULL,NULL,NULL,NULL,'2026-03-07 14:00:00');
MERGE INTO player (userid, discount_tier, rank_points) KEY(userid)
VALUES ('PLR003', 'STUDENT', 0);

MERGE INTO app_users (userid, name, email, password_hash, role, account_status,
    session_token, phone, date_of_birth, deletion_status, deletion_requested_at,
    otp_code, otp_expiry, created_at)
KEY(userid)
VALUES ('PLR004','Ayesha Siddiqui','ayesha.s@demo.com','Demo1234','PLAYER','APPROVED',
    NULL,'0301-4444444','2002-09-30',NULL,NULL,NULL,NULL,'2026-03-08 10:00:00');
MERGE INTO player (userid, discount_tier, rank_points) KEY(userid)
VALUES ('PLR004', 'STUDENT', 0);

-- Senior discount (20%)
MERGE INTO app_users (userid, name, email, password_hash, role, account_status,
    session_token, phone, date_of_birth, deletion_status, deletion_requested_at,
    otp_code, otp_expiry, created_at)
KEY(userid)
VALUES ('PLR005','Abdul Qadir','abdul.qadir@demo.com','Demo1234','PLAYER','APPROVED',
    NULL,'0311-5555555','1960-04-17',NULL,NULL,NULL,NULL,'2026-03-09 09:30:00');
MERGE INTO player (userid, discount_tier, rank_points) KEY(userid)
VALUES ('PLR005', 'SENIOR', 0);

MERGE INTO app_users (userid, name, email, password_hash, role, account_status,
    session_token, phone, date_of_birth, deletion_status, deletion_requested_at,
    otp_code, otp_expiry, created_at)
KEY(userid)
VALUES ('PLR006','Rubina Naz','rubina.naz@demo.com','Demo1234','PLAYER','APPROVED',
    NULL,'0322-6666666','1958-12-05',NULL,NULL,NULL,NULL,'2026-03-10 13:00:00');
MERGE INTO player (userid, discount_tier, rank_points) KEY(userid)
VALUES ('PLR006', 'SENIOR', 0);

-- Family discount (20%)
MERGE INTO app_users (userid, name, email, password_hash, role, account_status,
    session_token, phone, date_of_birth, deletion_status, deletion_requested_at,
    otp_code, otp_expiry, created_at)
KEY(userid)
VALUES ('PLR007','Khalid Iqbal','khalid.iqbal@demo.com','Demo1234','PLAYER','APPROVED',
    NULL,'0344-7777777','1990-08-25',NULL,NULL,NULL,NULL,'2026-03-11 16:00:00');
MERGE INTO player (userid, discount_tier, rank_points) KEY(userid)
VALUES ('PLR007', 'FAMILY', 0);

MERGE INTO app_users (userid, name, email, password_hash, role, account_status,
    session_token, phone, date_of_birth, deletion_status, deletion_requested_at,
    otp_code, otp_expiry, created_at)
KEY(userid)
VALUES ('PLR008','Nasreen Malik','nasreen.malik@demo.com','Demo1234','PLAYER','APPROVED',
    NULL,'0355-8888888','1987-02-11',NULL,NULL,NULL,NULL,'2026-03-12 12:00:00');
MERGE INTO player (userid, discount_tier, rank_points) KEY(userid)
VALUES ('PLR008', 'FAMILY', 0);


-- ── COURTS ───────────────────────────────────────────────────

-- TENNIS
MERGE INTO courts (courtid, name, sport_type, hourly_rate, capacity,
    open_time, close_time, slot_duration_minutes, status, description,
    manager_id, peak_start_time, peak_end_time, peak_multiplier, weekend_multiplier,
    maintenance_from, maintenance_to)
KEY(courtid)
VALUES ('CRT-TEN-1','Gulberg Tennis Court','TENNIS',1200,2,
    '07:00','22:00',60,'AVAILABLE','Well-maintained clay court in the heart of Gulberg.',
    'MGR001','17:00','21:00',1.5,1.25,NULL,NULL);

MERGE INTO courts (courtid, name, sport_type, hourly_rate, capacity,
    open_time, close_time, slot_duration_minutes, status, description,
    manager_id, peak_start_time, peak_end_time, peak_multiplier, weekend_multiplier,
    maintenance_from, maintenance_to)
KEY(courtid)
VALUES ('CRT-TEN-2','DHA Tennis Academy','TENNIS',1400,2,
    '07:00','22:00',60,'AVAILABLE','Premium hard court with covered seating area.',
    'MGR002','17:00','21:00',1.5,1.25,NULL,NULL);

-- CRICKET
MERGE INTO courts (courtid, name, sport_type, hourly_rate, capacity,
    open_time, close_time, slot_duration_minutes, status, description,
    manager_id, peak_start_time, peak_end_time, peak_multiplier, weekend_multiplier,
    maintenance_from, maintenance_to)
KEY(courtid)
VALUES ('CRT-CRI-1','Iqbal Park Cricket Ground','CRICKET',2500,22,
    '06:00','21:00',60,'AVAILABLE','Full-size turf wicket with proper boundary ropes.',
    'MGR001','15:00','20:00',1.4,1.3,NULL,NULL);

MERGE INTO courts (courtid, name, sport_type, hourly_rate, capacity,
    open_time, close_time, slot_duration_minutes, status, description,
    manager_id, peak_start_time, peak_end_time, peak_multiplier, weekend_multiplier,
    maintenance_from, maintenance_to)
KEY(courtid)
VALUES ('CRT-CRI-2','Model Town Cricket Club','CRICKET',2800,22,
    '06:00','21:00',60,'AVAILABLE','Professional cricket facility with coaching area.',
    'MGR002','15:00','20:00',1.4,1.3,NULL,NULL);

-- FOOTBALL
MERGE INTO courts (courtid, name, sport_type, hourly_rate, capacity,
    open_time, close_time, slot_duration_minutes, status, description,
    manager_id, peak_start_time, peak_end_time, peak_multiplier, weekend_multiplier,
    maintenance_from, maintenance_to)
KEY(courtid)
VALUES ('CRT-FOO-1','Defence Football Arena','FOOTBALL',2000,22,
    '06:00','22:00',60,'AVAILABLE','Full-size natural grass pitch with floodlights.',
    'MGR001','16:00','21:00',1.5,1.25,NULL,NULL);

MERGE INTO courts (courtid, name, sport_type, hourly_rate, capacity,
    open_time, close_time, slot_duration_minutes, status, description,
    manager_id, peak_start_time, peak_end_time, peak_multiplier, weekend_multiplier,
    maintenance_from, maintenance_to)
KEY(courtid)
VALUES ('CRT-FOO-2','Johar Town Football Ground','FOOTBALL',1800,22,
    '06:00','22:00',60,'AVAILABLE','Synthetic turf pitch suitable for 11-a-side matches.',
    'MGR002','16:00','21:00',1.5,1.25,NULL,NULL);

-- BASKETBALL
MERGE INTO courts (courtid, name, sport_type, hourly_rate, capacity,
    open_time, close_time, slot_duration_minutes, status, description,
    manager_id, peak_start_time, peak_end_time, peak_multiplier, weekend_multiplier,
    maintenance_from, maintenance_to)
KEY(courtid)
VALUES ('CRT-BAS-1','FAST Basketball Court','BASKETBALL',1000,10,
    '07:00','22:00',60,'AVAILABLE','Indoor hardwood court with scoreboard and shot clock.',
    'MGR001','17:00','21:00',1.5,1.2,NULL,NULL);

MERGE INTO courts (courtid, name, sport_type, hourly_rate, capacity,
    open_time, close_time, slot_duration_minutes, status, description,
    manager_id, peak_start_time, peak_end_time, peak_multiplier, weekend_multiplier,
    maintenance_from, maintenance_to)
KEY(courtid)
VALUES ('CRT-BAS-2','Punjab Sports Complex','BASKETBALL',1100,10,
    '07:00','22:00',60,'AVAILABLE','Olympic-standard indoor court with spectator stands.',
    'MGR002','17:00','21:00',1.5,1.2,NULL,NULL);

-- FUTSAL
MERGE INTO courts (courtid, name, sport_type, hourly_rate, capacity,
    open_time, close_time, slot_duration_minutes, status, description,
    manager_id, peak_start_time, peak_end_time, peak_multiplier, weekend_multiplier,
    maintenance_from, maintenance_to)
KEY(courtid)
VALUES ('CRT-FUT-1','Cavalry Futsal Arena','FUTSAL',1500,10,
    '08:00','23:00',60,'AVAILABLE','Indoor rubber-floored futsal court with goal nets.',
    'MGR001','17:00','22:00',1.4,1.25,NULL,NULL);

MERGE INTO courts (courtid, name, sport_type, hourly_rate, capacity,
    open_time, close_time, slot_duration_minutes, status, description,
    manager_id, peak_start_time, peak_end_time, peak_multiplier, weekend_multiplier,
    maintenance_from, maintenance_to)
KEY(courtid)
VALUES ('CRT-FUT-2','Packages Futsal Club','FUTSAL',1600,10,
    '08:00','23:00',60,'AVAILABLE','Premium astroturf futsal with changing rooms.',
    'MGR002','17:00','22:00',1.4,1.25,NULL,NULL);

-- BADMINTON
MERGE INTO courts (courtid, name, sport_type, hourly_rate, capacity,
    open_time, close_time, slot_duration_minutes, status, description,
    manager_id, peak_start_time, peak_end_time, peak_multiplier, weekend_multiplier,
    maintenance_from, maintenance_to)
KEY(courtid)
VALUES ('CRT-BAD-1','Lahore Badminton Hall','BADMINTON',700,4,
    '07:00','22:00',60,'AVAILABLE','Indoor PU floored court with proper lighting.',
    'MGR001','17:00','21:00',1.5,1.2,NULL,NULL);

MERGE INTO courts (courtid, name, sport_type, hourly_rate, capacity,
    open_time, close_time, slot_duration_minutes, status, description,
    manager_id, peak_start_time, peak_end_time, peak_multiplier, weekend_multiplier,
    maintenance_from, maintenance_to)
KEY(courtid)
VALUES ('CRT-BAD-2','Wapda Badminton Centre','BADMINTON',800,4,
    '07:00','22:00',60,'AVAILABLE','Air-conditioned hall with two professional courts.',
    'MGR002','17:00','21:00',1.5,1.2,NULL,NULL);

-- SQUASH
MERGE INTO courts (courtid, name, sport_type, hourly_rate, capacity,
    open_time, close_time, slot_duration_minutes, status, description,
    manager_id, peak_start_time, peak_end_time, peak_multiplier, weekend_multiplier,
    maintenance_from, maintenance_to)
KEY(courtid)
VALUES ('CRT-SQU-1','Zaman Park Squash Court','SQUASH',800,2,
    '07:00','22:00',60,'AVAILABLE','Glass-back squash court with viewing gallery.',
    'MGR001','17:00','21:00',1.5,1.2,NULL,NULL);

MERGE INTO courts (courtid, name, sport_type, hourly_rate, capacity,
    open_time, close_time, slot_duration_minutes, status, description,
    manager_id, peak_start_time, peak_end_time, peak_multiplier, weekend_multiplier,
    maintenance_from, maintenance_to)
KEY(courtid)
VALUES ('CRT-SQU-2','Gymkhana Squash Club','SQUASH',900,2,
    '07:00','22:00',60,'AVAILABLE','Historic club court restored to international standard.',
    'MGR002','17:00','21:00',1.5,1.2,NULL,NULL);

-- VOLLEYBALL
MERGE INTO courts (courtid, name, sport_type, hourly_rate, capacity,
    open_time, close_time, slot_duration_minutes, status, description,
    manager_id, peak_start_time, peak_end_time, peak_multiplier, weekend_multiplier,
    maintenance_from, maintenance_to)
KEY(courtid)
VALUES ('CRT-VOL-1','National Volleyball Court','VOLLEYBALL',900,12,
    '07:00','22:00',60,'AVAILABLE','Outdoor sand court with proper boundary markings.',
    'MGR001','17:00','21:00',1.4,1.2,NULL,NULL);

MERGE INTO courts (courtid, name, sport_type, hourly_rate, capacity,
    open_time, close_time, slot_duration_minutes, status, description,
    manager_id, peak_start_time, peak_end_time, peak_multiplier, weekend_multiplier,
    maintenance_from, maintenance_to)
KEY(courtid)
VALUES ('CRT-VOL-2','Nishtar Park Volleyball','VOLLEYBALL',1000,12,
    '07:00','22:00',60,'AVAILABLE','Indoor court with spring floor and raised net system.',
    'MGR002','17:00','21:00',1.4,1.2,NULL,NULL);


-- ── BOOKINGS ─────────────────────────────────────────────────

-- BKG001 | PLR001 (no disc) | CRT-TEN-1 | 2026-04-01 Wed | 10:00-11:00 | off-peak weekday
-- rate=1200 | total=1200 | disc=0
MERGE INTO bookings (bookingid, playerid, courtid, court_name, sport_type,
    booking_date, time_slot, base_rate, total_cost, discount_applied, peak_hour,
    status, created_at, confirmed_at, closed_at)
KEY(bookingid)
VALUES ('BKG001','PLR001','CRT-TEN-1','Gulberg Tennis Court','TENNIS',
    '2026-04-01','10:00-11:00',1200,1200,0,FALSE,
    'COMPLETED','2026-03-28 10:00:00','2026-03-28 10:05:00','2026-04-01 23:59:00');

-- BKG002 | PLR003 (STUDENT 20%) | CRT-CRI-1 | 2026-04-03 Fri | 09:00-10:00 | off-peak weekday
-- rate=2500 | disc=500 | total=2000
MERGE INTO bookings (bookingid, playerid, courtid, court_name, sport_type,
    booking_date, time_slot, base_rate, total_cost, discount_applied, peak_hour,
    status, created_at, confirmed_at, closed_at)
KEY(bookingid)
VALUES ('BKG002','PLR003','CRT-CRI-1','Iqbal Park Cricket Ground','CRICKET',
    '2026-04-03','09:00-10:00',2500,2000,500,FALSE,
    'COMPLETED','2026-03-29 11:00:00','2026-03-29 11:10:00','2026-04-03 23:59:00');

-- BKG003 | PLR005 (SENIOR 20%) | CRT-FOO-1 | 2026-04-05 Sun | 09:00-10:00 | off-peak weekend
-- rate=2000*1.25=2500 | disc=500 | total=2000
MERGE INTO bookings (bookingid, playerid, courtid, court_name, sport_type,
    booking_date, time_slot, base_rate, total_cost, discount_applied, peak_hour,
    status, created_at, confirmed_at, closed_at)
KEY(bookingid)
VALUES ('BKG003','PLR005','CRT-FOO-1','Defence Football Arena','FOOTBALL',
    '2026-04-05','09:00-10:00',2000,2000,500,FALSE,
    'COMPLETED','2026-03-31 09:00:00','2026-03-31 09:08:00','2026-04-05 23:59:00');

-- BKG004 | PLR007 (FAMILY 20%) | CRT-BAD-1 | 2026-04-05 Sun | 08:00-09:00 | off-peak weekend
-- rate=700*1.2=840 | disc=168 | total=672
MERGE INTO bookings (bookingid, playerid, courtid, court_name, sport_type,
    booking_date, time_slot, base_rate, total_cost, discount_applied, peak_hour,
    status, created_at, confirmed_at, closed_at)
KEY(bookingid)
VALUES ('BKG004','PLR007','CRT-BAD-1','Lahore Badminton Hall','BADMINTON',
    '2026-04-05','08:00-09:00',700,672,168,FALSE,
    'COMPLETED','2026-03-31 10:00:00','2026-03-31 10:06:00','2026-04-05 23:59:00');

-- BKG005 | PLR002 (no disc) | CRT-BAS-1 | 2026-04-08 Wed | 11:00-12:00 | off-peak weekday
-- rate=1000 | total=1000 | disc=0
MERGE INTO bookings (bookingid, playerid, courtid, court_name, sport_type,
    booking_date, time_slot, base_rate, total_cost, discount_applied, peak_hour,
    status, created_at, confirmed_at, closed_at)
KEY(bookingid)
VALUES ('BKG005','PLR002','CRT-BAS-1','FAST Basketball Court','BASKETBALL',
    '2026-04-08','11:00-12:00',1000,1000,0,FALSE,
    'COMPLETED','2026-04-04 14:00:00','2026-04-04 14:09:00','2026-04-08 23:59:00');

-- BKG006 | PLR004 (STUDENT 20%) | CRT-SQU-1 | 2026-04-10 Fri | 10:00-11:00 | off-peak weekday
-- rate=800 | disc=160 | total=640
MERGE INTO bookings (bookingid, playerid, courtid, court_name, sport_type,
    booking_date, time_slot, base_rate, total_cost, discount_applied, peak_hour,
    status, created_at, confirmed_at, closed_at)
KEY(bookingid)
VALUES ('BKG006','PLR004','CRT-SQU-1','Zaman Park Squash Court','SQUASH',
    '2026-04-10','10:00-11:00',800,640,160,FALSE,
    'COMPLETED','2026-04-06 12:00:00','2026-04-06 12:07:00','2026-04-10 23:59:00');

-- BKG007 | PLR006 (SENIOR 20%) | CRT-VOL-1 | 2026-04-12 Sun | 09:00-10:00 | off-peak weekend
-- rate=900*1.2=1080 | disc=216 | total=864
MERGE INTO bookings (bookingid, playerid, courtid, court_name, sport_type,
    booking_date, time_slot, base_rate, total_cost, discount_applied, peak_hour,
    status, created_at, confirmed_at, closed_at)
KEY(bookingid)
VALUES ('BKG007','PLR006','CRT-VOL-1','National Volleyball Court','VOLLEYBALL',
    '2026-04-12','09:00-10:00',900,864,216,FALSE,
    'COMPLETED','2026-04-08 15:00:00','2026-04-08 15:05:00','2026-04-12 23:59:00');

-- BKG008 | PLR008 (FAMILY 20%) | CRT-FUT-1 | 2026-04-14 Tue | 09:00-10:00 | off-peak weekday
-- rate=1500 | disc=300 | total=1200
MERGE INTO bookings (bookingid, playerid, courtid, court_name, sport_type,
    booking_date, time_slot, base_rate, total_cost, discount_applied, peak_hour,
    status, created_at, confirmed_at, closed_at)
KEY(bookingid)
VALUES ('BKG008','PLR008','CRT-FUT-1','Cavalry Futsal Arena','FUTSAL',
    '2026-04-14','09:00-10:00',1500,1200,300,FALSE,
    'COMPLETED','2026-04-10 10:00:00','2026-04-10 10:04:00','2026-04-14 23:59:00');

-- BKG009 | PLR001 (no disc) | CRT-TEN-2 | 2026-04-15 Wed | 18:00-19:00 | PEAK weekday
-- rate=1400*1.5=2100 | total=2100 | disc=0
MERGE INTO bookings (bookingid, playerid, courtid, court_name, sport_type,
    booking_date, time_slot, base_rate, total_cost, discount_applied, peak_hour,
    status, created_at, confirmed_at, closed_at)
KEY(bookingid)
VALUES ('BKG009','PLR001','CRT-TEN-2','DHA Tennis Academy','TENNIS',
    '2026-04-15','18:00-19:00',1400,2100,0,TRUE,
    'COMPLETED','2026-04-11 16:00:00','2026-04-11 16:08:00','2026-04-15 23:59:00');

-- BKG010 | PLR003 (STUDENT 20%) | CRT-BAS-2 | 2026-04-17 Fri | 17:00-18:00 | PEAK weekday
-- rate=1100*1.5=1650 | disc=330 | total=1320
MERGE INTO bookings (bookingid, playerid, courtid, court_name, sport_type,
    booking_date, time_slot, base_rate, total_cost, discount_applied, peak_hour,
    status, created_at, confirmed_at, closed_at)
KEY(bookingid)
VALUES ('BKG010','PLR003','CRT-BAS-2','Punjab Sports Complex','BASKETBALL',
    '2026-04-17','17:00-18:00',1100,1320,330,TRUE,
    'COMPLETED','2026-04-13 09:00:00','2026-04-13 09:06:00','2026-04-17 23:59:00');

-- BKG011 | PLR005 (SENIOR 20%) | CRT-CRI-2 | 2026-04-18 Sat | 16:00-17:00 | PEAK + WEEKEND
-- rate=2800*1.4*1.3=5096 | disc=1019 | total=4077
MERGE INTO bookings (bookingid, playerid, courtid, court_name, sport_type,
    booking_date, time_slot, base_rate, total_cost, discount_applied, peak_hour,
    status, created_at, confirmed_at, closed_at)
KEY(bookingid)
VALUES ('BKG011','PLR005','CRT-CRI-2','Model Town Cricket Club','CRICKET',
    '2026-04-18','16:00-17:00',2800,4077,1019,TRUE,
    'COMPLETED','2026-04-14 11:00:00','2026-04-14 11:09:00','2026-04-18 23:59:00');

-- BKG012 | PLR002 (no disc) | CRT-FOO-2 | 2026-04-20 Mon | 14:00-15:00 | CANCELLED
-- rate=1800 | total=1800 | disc=0
MERGE INTO bookings (bookingid, playerid, courtid, court_name, sport_type,
    booking_date, time_slot, base_rate, total_cost, discount_applied, peak_hour,
    status, created_at, confirmed_at, closed_at)
KEY(bookingid)
VALUES ('BKG012','PLR002','CRT-FOO-2','Johar Town Football Ground','FOOTBALL',
    '2026-04-20','14:00-15:00',1800,1800,0,FALSE,
    'CANCELLED','2026-04-16 10:00:00',NULL,'2026-04-18 09:30:00');

-- BKG013 | PLR007 (FAMILY 20%) | CRT-TEN-1 | 2026-04-22 Wed | 17:00-18:00 | PEAK weekday
-- rate=1200*1.5=1800 | disc=360 | total=1440
MERGE INTO bookings (bookingid, playerid, courtid, court_name, sport_type,
    booking_date, time_slot, base_rate, total_cost, discount_applied, peak_hour,
    status, created_at, confirmed_at, closed_at)
KEY(bookingid)
VALUES ('BKG013','PLR007','CRT-TEN-1','Gulberg Tennis Court','TENNIS',
    '2026-04-22','17:00-18:00',1200,1440,360,TRUE,
    'COMPLETED','2026-04-18 14:00:00','2026-04-18 14:07:00','2026-04-22 23:59:00');

-- BKG014 | PLR001 (no disc) | CRT-SQU-2 | 2026-04-23 Thu | 11:00-12:00 | off-peak weekday
-- rate=900 | total=900 | disc=0
MERGE INTO bookings (bookingid, playerid, courtid, court_name, sport_type,
    booking_date, time_slot, base_rate, total_cost, discount_applied, peak_hour,
    status, created_at, confirmed_at, closed_at)
KEY(bookingid)
VALUES ('BKG014','PLR001','CRT-SQU-2','Gymkhana Squash Club','SQUASH',
    '2026-04-23','11:00-12:00',900,900,0,FALSE,
    'COMPLETED','2026-04-19 13:00:00','2026-04-19 13:05:00','2026-04-23 23:59:00');

-- BKG015 | PLR004 (STUDENT 20%) | CRT-FOO-1 | 2026-04-25 Sat | 16:00-17:00 | PEAK + WEEKEND
-- rate=2000*1.5*1.25=3750 | disc=750 | total=3000
MERGE INTO bookings (bookingid, playerid, courtid, court_name, sport_type,
    booking_date, time_slot, base_rate, total_cost, discount_applied, peak_hour,
    status, created_at, confirmed_at, closed_at)
KEY(bookingid)
VALUES ('BKG015','PLR004','CRT-FOO-1','Defence Football Arena','FOOTBALL',
    '2026-04-25','16:00-17:00',2000,3000,750,TRUE,
    'COMPLETED','2026-04-21 10:00:00','2026-04-21 10:06:00','2026-04-25 23:59:00');

-- BKG016 | PLR006 (SENIOR 20%) | CRT-BAD-2 | 2026-04-25 Sat | 18:00-19:00 | PEAK + WEEKEND
-- rate=800*1.5*1.2=1440 | disc=288 | total=1152
MERGE INTO bookings (bookingid, playerid, courtid, court_name, sport_type,
    booking_date, time_slot, base_rate, total_cost, discount_applied, peak_hour,
    status, created_at, confirmed_at, closed_at)
KEY(bookingid)
VALUES ('BKG016','PLR006','CRT-BAD-2','Wapda Badminton Centre','BADMINTON',
    '2026-04-25','18:00-19:00',800,1152,288,TRUE,
    'COMPLETED','2026-04-21 11:00:00','2026-04-21 11:04:00','2026-04-25 23:59:00');

-- BKG017 | PLR008 (FAMILY 20%) | CRT-CRI-1 | 2026-04-28 Tue | 10:00-11:00 | off-peak weekday
-- rate=2500 | disc=500 | total=2000
MERGE INTO bookings (bookingid, playerid, courtid, court_name, sport_type,
    booking_date, time_slot, base_rate, total_cost, discount_applied, peak_hour,
    status, created_at, confirmed_at, closed_at)
KEY(bookingid)
VALUES ('BKG017','PLR008','CRT-CRI-1','Iqbal Park Cricket Ground','CRICKET',
    '2026-04-28','10:00-11:00',2500,2000,500,FALSE,
    'COMPLETED','2026-04-24 09:00:00','2026-04-24 09:07:00','2026-04-28 23:59:00');

-- BKG018 | PLR002 (no disc) | CRT-VOL-2 | 2026-04-30 Thu | 17:00-18:00 | PEAK weekday
-- rate=1000*1.4=1400 | total=1400 | disc=0
MERGE INTO bookings (bookingid, playerid, courtid, court_name, sport_type,
    booking_date, time_slot, base_rate, total_cost, discount_applied, peak_hour,
    status, created_at, confirmed_at, closed_at)
KEY(bookingid)
VALUES ('BKG018','PLR002','CRT-VOL-2','Nishtar Park Volleyball','VOLLEYBALL',
    '2026-04-30','17:00-18:00',1000,1400,0,TRUE,
    'COMPLETED','2026-04-26 16:00:00','2026-04-26 16:08:00','2026-04-30 23:59:00');

-- BKG019 | PLR003 (STUDENT 20%) | CRT-FUT-2 | 2026-05-01 Fri | 09:00-10:00 | off-peak weekday
-- rate=1600 | disc=320 | total=1280
MERGE INTO bookings (bookingid, playerid, courtid, court_name, sport_type,
    booking_date, time_slot, base_rate, total_cost, discount_applied, peak_hour,
    status, created_at, confirmed_at, closed_at)
KEY(bookingid)
VALUES ('BKG019','PLR003','CRT-FUT-2','Packages Futsal Club','FUTSAL',
    '2026-05-01','09:00-10:00',1600,1280,320,FALSE,
    'COMPLETED','2026-04-27 10:00:00','2026-04-27 10:05:00','2026-05-01 23:59:00');

-- BKG020 | PLR005 (SENIOR 20%) | CRT-BAS-1 | 2026-05-03 Sun | 17:00-18:00 | PEAK + WEEKEND
-- rate=1000*1.5*1.2=1800 | disc=360 | total=1440
MERGE INTO bookings (bookingid, playerid, courtid, court_name, sport_type,
    booking_date, time_slot, base_rate, total_cost, discount_applied, peak_hour,
    status, created_at, confirmed_at, closed_at)
KEY(bookingid)
VALUES ('BKG020','PLR005','CRT-BAS-1','FAST Basketball Court','BASKETBALL',
    '2026-05-03','17:00-18:00',1000,1440,360,TRUE,
    'COMPLETED','2026-04-29 12:00:00','2026-04-29 12:06:00','2026-05-03 23:59:00');

-- BKG021 | PLR001 (no disc) | CRT-BAD-1 | 2026-05-05 Tue | 19:00-20:00 | PEAK weekday
-- rate=700*1.5=1050 | total=1050 | disc=0
MERGE INTO bookings (bookingid, playerid, courtid, court_name, sport_type,
    booking_date, time_slot, base_rate, total_cost, discount_applied, peak_hour,
    status, created_at, confirmed_at, closed_at)
KEY(bookingid)
VALUES ('BKG021','PLR001','CRT-BAD-1','Lahore Badminton Hall','BADMINTON',
    '2026-05-05','19:00-20:00',700,1050,0,TRUE,
    'COMPLETED','2026-05-01 09:00:00','2026-05-01 09:04:00','2026-05-05 23:59:00');

-- BKG022 | PLR007 (FAMILY 20%) | CRT-SQU-1 | 2026-05-07 Thu | 10:00-11:00 | off-peak weekday
-- rate=800 | disc=160 | total=640
MERGE INTO bookings (bookingid, playerid, courtid, court_name, sport_type,
    booking_date, time_slot, base_rate, total_cost, discount_applied, peak_hour,
    status, created_at, confirmed_at, closed_at)
KEY(bookingid)
VALUES ('BKG022','PLR007','CRT-SQU-1','Zaman Park Squash Court','SQUASH',
    '2026-05-07','10:00-11:00',800,640,160,FALSE,
    'COMPLETED','2026-05-03 11:00:00','2026-05-03 11:05:00','2026-05-07 23:59:00');

-- BKG023 | PLR002 (no disc) | CRT-TEN-1 | 2026-05-09 Sat | 08:00-09:00 | off-peak weekend
-- rate=1200*1.25=1500 | total=1500 | disc=0
MERGE INTO bookings (bookingid, playerid, courtid, court_name, sport_type,
    booking_date, time_slot, base_rate, total_cost, discount_applied, peak_hour,
    status, created_at, confirmed_at, closed_at)
KEY(bookingid)
VALUES ('BKG023','PLR002','CRT-TEN-1','Gulberg Tennis Court','TENNIS',
    '2026-05-09','08:00-09:00',1200,1500,0,FALSE,
    'COMPLETED','2026-05-05 14:00:00','2026-05-05 14:06:00','2026-05-09 23:59:00');

-- ── TODAY (May 10, 2026 — Sunday / Weekend) ───────────────────

-- BKG024 | PLR004 (STUDENT 20%) | CRT-VOL-1 | 2026-05-10 Sun | 18:00-19:00 | PEAK + WEEKEND
-- rate=900*1.4*1.2=1512 | disc=302 | total=1210
MERGE INTO bookings (bookingid, playerid, courtid, court_name, sport_type,
    booking_date, time_slot, base_rate, total_cost, discount_applied, peak_hour,
    status, created_at, confirmed_at, closed_at)
KEY(bookingid)
VALUES ('BKG024','PLR004','CRT-VOL-1','National Volleyball Court','VOLLEYBALL',
    '2026-05-10','18:00-19:00',900,1210,302,TRUE,
    'CONFIRMED','2026-05-08 09:00:00','2026-05-08 09:05:00',NULL);

-- BKG025 | PLR006 (SENIOR 20%) | CRT-TEN-2 | 2026-05-10 Sun | 11:00-12:00 | off-peak weekend
-- rate=1400*1.25=1750 | disc=350 | total=1400
MERGE INTO bookings (bookingid, playerid, courtid, court_name, sport_type,
    booking_date, time_slot, base_rate, total_cost, discount_applied, peak_hour,
    status, created_at, confirmed_at, closed_at)
KEY(bookingid)
VALUES ('BKG025','PLR006','CRT-TEN-2','DHA Tennis Academy','TENNIS',
    '2026-05-10','11:00-12:00',1400,1400,350,FALSE,
    'CONFIRMED','2026-05-08 10:00:00','2026-05-08 10:07:00',NULL);

-- BKG026 | PLR008 (FAMILY 20%) | CRT-FUT-2 | 2026-05-10 Sun | 17:00-18:00 | PEAK + WEEKEND
-- rate=1600*1.4*1.25=2800 | disc=560 | total=2240
MERGE INTO bookings (bookingid, playerid, courtid, court_name, sport_type,
    booking_date, time_slot, base_rate, total_cost, discount_applied, peak_hour,
    status, created_at, confirmed_at, closed_at)
KEY(bookingid)
VALUES ('BKG026','PLR008','CRT-FUT-2','Packages Futsal Club','FUTSAL',
    '2026-05-10','17:00-18:00',1600,2240,560,TRUE,
    'CONFIRMED','2026-05-08 10:30:00','2026-05-08 10:34:00',NULL);

-- ── FUTURE — CONFIRMED (May 12–14) ───────────────────────────

-- BKG027 | PLR001 (no disc) | CRT-CRI-1 | 2026-05-12 Tue | 09:00-10:00 | off-peak weekday
-- rate=2500 | total=2500 | disc=0
MERGE INTO bookings (bookingid, playerid, courtid, court_name, sport_type,
    booking_date, time_slot, base_rate, total_cost, discount_applied, peak_hour,
    status, created_at, confirmed_at, closed_at)
KEY(bookingid)
VALUES ('BKG027','PLR001','CRT-CRI-1','Iqbal Park Cricket Ground','CRICKET',
    '2026-05-12','09:00-10:00',2500,2500,0,FALSE,
    'CONFIRMED','2026-05-09 11:00:00','2026-05-09 11:08:00',NULL);

-- BKG028 | PLR003 (STUDENT 20%) | CRT-FOO-2 | 2026-05-14 Thu | 17:00-18:00 | PEAK weekday
-- rate=1800*1.5=2700 | disc=540 | total=2160
MERGE INTO bookings (bookingid, playerid, courtid, court_name, sport_type,
    booking_date, time_slot, base_rate, total_cost, discount_applied, peak_hour,
    status, created_at, confirmed_at, closed_at)
KEY(bookingid)
VALUES ('BKG028','PLR003','CRT-FOO-2','Johar Town Football Ground','FOOTBALL',
    '2026-05-14','17:00-18:00',1800,2160,540,TRUE,
    'CONFIRMED','2026-05-09 12:00:00','2026-05-09 12:05:00',NULL);

-- ── FUTURE — PENDING (May 16–31) ─────────────────────────────

-- BKG029 | PLR005 (SENIOR 20%) | CRT-BAD-1 | 2026-05-16 Sat | 18:00-19:00 | PEAK + WEEKEND
-- rate=700*1.5*1.2=1260 | disc=252 | total=1008
MERGE INTO bookings (bookingid, playerid, courtid, court_name, sport_type,
    booking_date, time_slot, base_rate, total_cost, discount_applied, peak_hour,
    status, created_at, confirmed_at, closed_at)
KEY(bookingid)
VALUES ('BKG029','PLR005','CRT-BAD-1','Lahore Badminton Hall','BADMINTON',
    '2026-05-16','18:00-19:00',700,1008,252,TRUE,
    'PENDING','2026-05-10 08:00:00',NULL,NULL);

-- BKG030 | PLR007 (FAMILY 20%) | CRT-BAS-2 | 2026-05-18 Mon | 10:00-11:00 | off-peak weekday
-- rate=1100 | disc=220 | total=880
MERGE INTO bookings (bookingid, playerid, courtid, court_name, sport_type,
    booking_date, time_slot, base_rate, total_cost, discount_applied, peak_hour,
    status, created_at, confirmed_at, closed_at)
KEY(bookingid)
VALUES ('BKG030','PLR007','CRT-BAS-2','Punjab Sports Complex','BASKETBALL',
    '2026-05-18','10:00-11:00',1100,880,220,FALSE,
    'PENDING','2026-05-10 08:30:00',NULL,NULL);

-- BKG031 | PLR002 (no disc) | CRT-SQU-2 | 2026-05-20 Wed | 19:00-20:00 | PEAK weekday
-- rate=900*1.5=1350 | total=1350 | disc=0
MERGE INTO bookings (bookingid, playerid, courtid, court_name, sport_type,
    booking_date, time_slot, base_rate, total_cost, discount_applied, peak_hour,
    status, created_at, confirmed_at, closed_at)
KEY(bookingid)
VALUES ('BKG031','PLR002','CRT-SQU-2','Gymkhana Squash Club','SQUASH',
    '2026-05-20','19:00-20:00',900,1350,0,TRUE,
    'PENDING','2026-05-10 09:00:00',NULL,NULL);

-- BKG032 | PLR004 (STUDENT 20%) | CRT-CRI-2 | 2026-05-23 Sat | 15:00-16:00 | PEAK + WEEKEND
-- rate=2800*1.4*1.3=5096 | disc=1019 | total=4077
MERGE INTO bookings (bookingid, playerid, courtid, court_name, sport_type,
    booking_date, time_slot, base_rate, total_cost, discount_applied, peak_hour,
    status, created_at, confirmed_at, closed_at)
KEY(bookingid)
VALUES ('BKG032','PLR004','CRT-CRI-2','Model Town Cricket Club','CRICKET',
    '2026-05-23','15:00-16:00',2800,4077,1019,TRUE,
    'PENDING','2026-05-10 09:30:00',NULL,NULL);

-- BKG033 | PLR006 (SENIOR 20%) | CRT-VOL-2 | 2026-05-25 Mon | 09:00-10:00 | off-peak weekday
-- rate=1000 | disc=200 | total=800
MERGE INTO bookings (bookingid, playerid, courtid, court_name, sport_type,
    booking_date, time_slot, base_rate, total_cost, discount_applied, peak_hour,
    status, created_at, confirmed_at, closed_at)
KEY(bookingid)
VALUES ('BKG033','PLR006','CRT-VOL-2','Nishtar Park Volleyball','VOLLEYBALL',
    '2026-05-25','09:00-10:00',1000,800,200,FALSE,
    'PENDING','2026-05-10 10:00:00',NULL,NULL);

-- BKG034 | PLR008 (FAMILY 20%) | CRT-FOO-1 | 2026-05-25 Mon | 16:00-17:00 | PEAK weekday
-- rate=2000*1.5=3000 | disc=600 | total=2400
MERGE INTO bookings (bookingid, playerid, courtid, court_name, sport_type,
    booking_date, time_slot, base_rate, total_cost, discount_applied, peak_hour,
    status, created_at, confirmed_at, closed_at)
KEY(bookingid)
VALUES ('BKG034','PLR008','CRT-FOO-1','Defence Football Arena','FOOTBALL',
    '2026-05-25','16:00-17:00',2000,2400,600,TRUE,
    'PENDING','2026-05-10 10:15:00',NULL,NULL);

-- BKG035 | PLR001 (no disc) | CRT-TEN-2 | 2026-05-27 Wed | 08:00-09:00 | off-peak weekday
-- rate=1400 | total=1400 | disc=0
MERGE INTO bookings (bookingid, playerid, courtid, court_name, sport_type,
    booking_date, time_slot, base_rate, total_cost, discount_applied, peak_hour,
    status, created_at, confirmed_at, closed_at)
KEY(bookingid)
VALUES ('BKG035','PLR001','CRT-TEN-2','DHA Tennis Academy','TENNIS',
    '2026-05-27','08:00-09:00',1400,1400,0,FALSE,
    'PENDING','2026-05-10 10:30:00',NULL,NULL);

-- BKG036 | PLR003 (STUDENT 20%) | CRT-FUT-1 | 2026-05-30 Sat | 17:00-18:00 | PEAK + WEEKEND
-- rate=1500*1.4*1.25=2625 | disc=525 | total=2100
MERGE INTO bookings (bookingid, playerid, courtid, court_name, sport_type,
    booking_date, time_slot, base_rate, total_cost, discount_applied, peak_hour,
    status, created_at, confirmed_at, closed_at)
KEY(bookingid)
VALUES ('BKG036','PLR003','CRT-FUT-1','Cavalry Futsal Arena','FUTSAL',
    '2026-05-30','17:00-18:00',1500,2100,525,TRUE,
    'PENDING','2026-05-10 11:00:00',NULL,NULL);

-- BKG037 | PLR002 (no disc) | CRT-BAD-2 | 2026-05-30 Sat | 10:00-11:00 | off-peak weekend
-- rate=800*1.2=960 | total=960 | disc=0
MERGE INTO bookings (bookingid, playerid, courtid, court_name, sport_type,
    booking_date, time_slot, base_rate, total_cost, discount_applied, peak_hour,
    status, created_at, confirmed_at, closed_at)
KEY(bookingid)
VALUES ('BKG037','PLR002','CRT-BAD-2','Wapda Badminton Centre','BADMINTON',
    '2026-05-30','10:00-11:00',800,960,0,FALSE,
    'PENDING','2026-05-10 11:15:00',NULL,NULL);


-- ── FACILITY RATINGS ─────────────────────────────────────────

MERGE INTO facility_ratings (ratingid, bookingid, playerid, courtid, court_name,
    sport_type, booking_date, rating_score, feedback_text, submitted_at)
KEY(ratingid)
VALUES ('RTG001','BKG001','PLR001','CRT-TEN-1','Gulberg Tennis Court',
    'TENNIS','2026-04-01',4,'Great court, surfaces are very well maintained.',
    '2026-04-01 20:00:00');

MERGE INTO facility_ratings (ratingid, bookingid, playerid, courtid, court_name,
    sport_type, booking_date, rating_score, feedback_text, submitted_at)
KEY(ratingid)
VALUES ('RTG002','BKG003','PLR005','CRT-FOO-1','Defence Football Arena',
    'FOOTBALL','2026-04-05',5,'Excellent facility with very professional staff. Highly recommend.',
    '2026-04-05 21:00:00');

MERGE INTO facility_ratings (ratingid, bookingid, playerid, courtid, court_name,
    sport_type, booking_date, rating_score, feedback_text, submitted_at)
KEY(ratingid)
VALUES ('RTG003','BKG005','PLR002','CRT-BAS-1','FAST Basketball Court',
    'BASKETBALL','2026-04-08',3,'Decent court but the changing rooms need improvement.',
    '2026-04-08 19:30:00');

MERGE INTO facility_ratings (ratingid, bookingid, playerid, courtid, court_name,
    sport_type, booking_date, rating_score, feedback_text, submitted_at)
KEY(ratingid)
VALUES ('RTG004','BKG007','PLR006','CRT-VOL-1','National Volleyball Court',
    'VOLLEYBALL','2026-04-12',5,'Perfect setup — loved the lighting and clean sand court.',
    '2026-04-12 20:30:00');

MERGE INTO facility_ratings (ratingid, bookingid, playerid, courtid, court_name,
    sport_type, booking_date, rating_score, feedback_text, submitted_at)
KEY(ratingid)
VALUES ('RTG005','BKG009','PLR001','CRT-TEN-2','DHA Tennis Academy',
    'TENNIS','2026-04-15',4,'Good nets and clearly marked court lines. Would book again.',
    '2026-04-15 21:00:00');

MERGE INTO facility_ratings (ratingid, bookingid, playerid, courtid, court_name,
    sport_type, booking_date, rating_score, feedback_text, submitted_at)
KEY(ratingid)
VALUES ('RTG006','BKG011','PLR005','CRT-CRI-2','Model Town Cricket Club',
    'CRICKET','2026-04-18',4,'Nice pitch and proper stumps. Parking could be better.',
    '2026-04-18 22:00:00');

MERGE INTO facility_ratings (ratingid, bookingid, playerid, courtid, court_name,
    sport_type, booking_date, rating_score, feedback_text, submitted_at)
KEY(ratingid)
VALUES ('RTG007','BKG013','PLR007','CRT-TEN-1','Gulberg Tennis Court',
    'TENNIS','2026-04-22',5,'Best tennis court in Lahore! Will definitely come back.',
    '2026-04-22 20:00:00');

MERGE INTO facility_ratings (ratingid, bookingid, playerid, courtid, court_name,
    sport_type, booking_date, rating_score, feedback_text, submitted_at)
KEY(ratingid)
VALUES ('RTG008','BKG015','PLR004','CRT-FOO-1','Defence Football Arena',
    'FOOTBALL','2026-04-25',3,'Surface was a bit slippery after rain. Otherwise fine.',
    '2026-04-25 21:30:00');

MERGE INTO facility_ratings (ratingid, bookingid, playerid, courtid, court_name,
    sport_type, booking_date, rating_score, feedback_text, submitted_at)
KEY(ratingid)
VALUES ('RTG009','BKG017','PLR008','CRT-CRI-1','Iqbal Park Cricket Ground',
    'CRICKET','2026-04-28',4,'Great ground with high-quality stumps and crease markings.',
    '2026-04-28 20:45:00');

MERGE INTO facility_ratings (ratingid, bookingid, playerid, courtid, court_name,
    sport_type, booking_date, rating_score, feedback_text, submitted_at)
KEY(ratingid)
VALUES ('RTG010','BKG019','PLR003','CRT-FUT-2','Packages Futsal Club',
    'FUTSAL','2026-05-01',5,'Fantastic futsal arena — clean, spacious, great flooring.',
    '2026-05-01 21:00:00');

-- ── OAuth2 social login ──────────────────────────────────────────────────────
-- Seeded and pre-existing accounts use email/password. Hibernate adds the
-- auth_provider / provider_id columns; Google/GitHub sign-ups fill them in.
UPDATE app_users SET auth_provider = 'LOCAL' WHERE auth_provider IS NULL;

-- ── Match result status (FR-38) ──────────────────────────────────────────────
-- Results saved before disputes existed are valid.
UPDATE match_results SET status = 'VALID' WHERE status IS NULL;

-- ── Facilities (class diagram: Facility, ERD: FACILITY) ──────────────────────
-- Inserted only once, so details a manager edits are kept across restarts.
-- FacilityBackfill links each manager's courts (and their ratings) to the facility.
INSERT INTO facilities (facilityid, name, location, opening_time, closing_time, manager_id, created_at)
SELECT 'FAC-001', 'Gulberg Sports Arena', 'Main Boulevard, Gulberg III, Lahore', '07:00', '23:00', 'MGR001', '2026-03-01 10:00:00'
WHERE NOT EXISTS (SELECT 1 FROM facilities WHERE facilityid = 'FAC-001' OR manager_id = 'MGR001');

INSERT INTO facilities (facilityid, name, location, opening_time, closing_time, manager_id, created_at)
SELECT 'FAC-002', 'DHA Sports Complex', 'Phase 5, DHA, Lahore', '07:00', '23:00', 'MGR002', '2026-03-01 10:00:00'
WHERE NOT EXISTS (SELECT 1 FROM facilities WHERE facilityid = 'FAC-002' OR manager_id = 'MGR002');
