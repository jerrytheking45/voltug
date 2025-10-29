const axios = require("axios");

exports.callEasyPay = async (payload) => {
    const apiUrl = process.env.EASYPAY_API_URL;
    const username = process.env.EASYPAY_USERNAME;
    const password = process.env.EASYPAY_PASSWORD;

    const data = { username, password, ...payload };

    const response = await axios.post(apiUrl, data, {
        headers: { "Content-Type": "application/json" },
        timeout: 30000
    });

    return response.data;
};
