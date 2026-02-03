const response = (res, status, success, message, data = null) => {
    return res.status(status).json({
        status: success,
        message: message,
        data: data
    });
};

module.exports = {
    response
};
