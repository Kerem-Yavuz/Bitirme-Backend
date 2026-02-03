const express = require("express");
const router = express.Router();
const con = require("./models/db");
const jwt = require("jsonwebtoken");
const { ACCESS_JWT_SECRET, REFRESH_JWT_SECRET } = require("./models/constants");
const { isAuthenticated, isHavePriv } = require("./functions/middleware");
const { response } = require("./functions/utils");

// Login Endpoint
router.post("/login", (req, res) => {
    const { usernameoremail, password } = req.body;

    if (!usernameoremail || !password) {
        return response(res, 400, false, "Username/Email and Password are required.");
    }

    const query = `
        SELECT u.userID, u.password, u.active, ud.email, ud.fullName 
        FROM users u 
        LEFT JOIN userDetails ud ON u.userID = ud.userID 
        WHERE (ud.email = ? OR u.userID = ?) AND u.password = ?
    `;

    con.query(query, [usernameoremail, usernameoremail, password], (err, results) => {
        if (err) return response(res, 500, false, err.message);

        if (results.length === 0) {
            return response(res, 401, false, "Invalid credentials or user not found.");
        }

        const user = results[0];
        if (!user.active) {
            return response(res, 403, false, "Account is inactive.");
        }

        const accessToken = jwt.sign(
            { id: user.userID, email: user.email, fullName: user.fullName },
            ACCESS_JWT_SECRET,
            { expiresIn: "15m" }
        );

        const refreshToken = jwt.sign(
            { id: user.userID },
            REFRESH_JWT_SECRET,
            { expiresIn: "7d" }
        );

        // Store Refresh Token (Reset isRevoked)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        // source hardcoded 1

        // Upsert Token and ensure isRevoked is false for new login
        const insertTokenQuery = "INSERT INTO refresh_tokens (token, userID, expires_at, isRevoked) VALUES (?, ?, ?, 0) ON DUPLICATE KEY UPDATE token = VALUES(token), expires_at = VALUES(expires_at), isRevoked = 0";

        con.query(insertTokenQuery, [refreshToken, user.userID, expiresAt], (errToken) => {
            if (errToken) return response(res, 500, false, "Session creation failed: " + errToken.message);

            res.cookie("kilitSistemi_token", accessToken, { httpOnly: true, maxAge: 15 * 60 * 1000 });
            res.cookie("kilitSistemi_refreshToken", refreshToken, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });

            return response(res, 200, true, "Login successful.", {
                id: user.userID,
                email: user.email,
                fullName: user.fullName,
                accessToken,
                refreshToken
            });
        });
    });
});

// Logout Endpoint
router.post("/logout", isAuthenticated, (req, res) => {
    // We can use req.user.id to find the token
    const userID = req.user.id;

    // Revoke the token in DB
    con.query("UPDATE refresh_tokens SET isRevoked = 1 WHERE userID = ?", [userID], (err, result) => {
        if (err) console.error("Logout revoke failed:", err); // Log but don't fail response
    });

    res.clearCookie("kilitSistemi_token");
    res.clearCookie("kilitSistemi_refreshToken");
    return response(res, 200, true, "Logged out successfully.");
});

// Create User (Admin only)
router.post("/", isAuthenticated, isHavePriv("Admin"), (req, res) => {
    const { password, active, fullName, phoneNo, email, departmentID } = req.body;

    if (!password) {
        return response(res, 400, false, "Password is required.");
    }

    const isActive = active !== undefined ? active : true;

    con.query("INSERT INTO users (password, active) VALUES (?, ?)", [password, isActive], (err, result) => {
        if (err) return response(res, 500, false, err.message);

        const userID = result.insertId;

        if (fullName || email) {
            con.query("INSERT INTO userDetails (userID, fullName, phoneNo, email, departmentID) VALUES (?, ?, ?, ?, ?)",
                [userID, fullName, phoneNo, email, departmentID], (errDetail) => {
                    if (errDetail) return response(res, 500, false, "User created but details failed: " + errDetail.message);
                    return response(res, 201, true, "User created successfully.", { id: userID, ...req.body });
                });
        } else {
            return response(res, 201, true, "User created successfully.", { id: userID, ...req.body });
        }
    });
});

// Get All Users (Admin only)
router.get("/", isAuthenticated, isHavePriv("Admin"), (req, res) => {
    con.query("SELECT u.userID, u.active, ud.fullName, ud.phoneNo, ud.email, ud.departmentID FROM users u LEFT JOIN userDetails ud ON u.userID = ud.userID", (err, result) => {
        if (err) return response(res, 500, false, err.message);
        return response(res, 200, true, "Users retrieved.", result);
    });
});

// Get Single User (Admin or Self)
router.get("/:id", isAuthenticated, (req, res) => {
    const id = req.params.id;
    con.query("SELECT u.userID, u.active, ud.fullName, ud.phoneNo, ud.email, ud.departmentID FROM users u LEFT JOIN userDetails ud ON u.userID = ud.userID WHERE u.userID = ?", [id], (err, result) => {
        if (err) return response(res, 500, false, err.message);
        if (result.length === 0) return response(res, 404, false, "User not found");
        return response(res, 200, true, "User retrieved.", result[0]);
    });
});

module.exports = router;
