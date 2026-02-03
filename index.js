const express = require("express");
const cors = require("cors");


require("dotenv").config();

const app = express();

const corsOptions = {
    origin: "*"
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection is handled in components/models/db.js

// Base API URL
const BASE_URL = "/api";

// Routes
const users = require("./components/users");
const departments = require("./components/departments");
const lessons = require("./components/lessons");
const lessonGroups = require("./components/lessonGroups");

app.use(`${BASE_URL}/users`, users);
app.use(`${BASE_URL}/departments`, departments);
app.use(`${BASE_URL}/lessons`, lessons);
app.use(`${BASE_URL}/lessonGroups`, lessonGroups);

// Simple route
app.get("/", (req, res) => {
    res.json({ message: "Welcome to the application." });
});

// Port configuration
const PORT = process.env.PORT || 8001;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}.`);
});
