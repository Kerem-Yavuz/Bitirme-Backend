const jwt = require("jsonwebtoken");
const { ACCESS_JWT_SECRET, REFRESH_JWT_SECRET } = require("../models/constants");
const con = require("../models/db");
const { response } = require("./utils"); // Assuming circular dependency is fine or structure allows

const isAuthenticated = (req, res, next) => {
    let accessToken = req.cookies?.accessToken || req.headers["authorization"]?.split(" ")[1];
    const refreshToken = req.cookies?.refreshToken;

    if (accessToken) {
        jwt.verify(accessToken, ACCESS_JWT_SECRET, (err, decoded) => {
            if (err) {
                if (err.name === "TokenExpiredError") {
                    return handleAutoRefresh(refreshToken, req, res, next);
                } else {
                    return response(res, 401, false, "Unauthorized! Invalid Token.");
                }
            } else {
                req.user = decoded;
                next();
            }
        });
    } else if (refreshToken) {
        return handleAutoRefresh(refreshToken, req, res, next);
    } else {
        return response(res, 401, false, "No token provided.");
    }
};

const handleAutoRefresh = (refreshToken, req, res, next) => {
    if (!refreshToken) {
        return response(res, 401, false, "Session expired and no refresh token available.");
    }

    jwt.verify(refreshToken, REFRESH_JWT_SECRET, (refreshErr, refreshDecoded) => {
        if (refreshErr) {
            return response(res, 401, false, "Refresh token invalid or expired.");
        }

        const query = "SELECT * FROM refresh_tokens WHERE userID = ? AND token = ? AND isRevoked = 0";
        con.query(query, [refreshDecoded.id, refreshToken], (dbErr, results) => {
            if (dbErr || results.length === 0) {
                return response(res, 401, false, "Refresh token revoked or not found.");
            }

            con.query("SELECT u.userID, ud.email, ud.fullName FROM users u LEFT JOIN userDetails ud ON u.userID = ud.userID WHERE u.userID = ?", [refreshDecoded.id], (uErr, uRes) => {
                if (uErr || uRes.length === 0) {
                    return response(res, 401, false, "User not found during refresh.");
                }
                const user = uRes[0];
                const newAccessToken = jwt.sign(
                    { id: user.userID, email: user.email, fullName: user.fullName },
                    ACCESS_JWT_SECRET,
                    { expiresIn: "15m" }
                );

                res.cookie("accessToken", newAccessToken, {
                    httpOnly: true,
                    secure: false, 
                    sameSite: 'Lax',
                    path: '/',
                    maxAge: 15 * 60 * 1000
                });

                req.user = jwt.decode(newAccessToken); 
                next();
            });
        });
    });
};

const isHavePriv = (requiredPrivilege) => {
    return (req, res, next) => {
        // Ensure isAuthenticated was called and passed
        if (!req.user || !req.user.id) {
            return response(res, 401, false, "User not authenticated.");
        }

        const userID = req.user.id;

        const query = `
            SELECT p.privilegeName 
            FROM user_privileges up 
            JOIN privileges p ON up.privID = p.privilegeID 
            WHERE up.userID = ?
        `;

        con.query(query, [userID], (err, results) => {
            if (err) return response(res, 500, false, err.message);

            const privileges = results.map(r => r.privilegeName);

            req.user.privs = privileges;

            if (privileges.includes("Admin")) {
                return next();
            }

            if (!requiredPrivilege) {
                return next();
            }

            if (privileges.includes(requiredPrivilege)) {
                return next();
            }

            return response(res, 403, false, "Require " + requiredPrivilege + " Privilege!");
        });
    };
};

module.exports = {
    isAuthenticated,
    isHavePriv
};
