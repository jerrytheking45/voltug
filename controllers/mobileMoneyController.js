const { callEasyPay } = require("../utils/easypayApi");

exports.deposit = async (req, res) => {
    const { phone, amount, reference, reason } = req.body;
    try {
        const response = await callEasyPay({ action: "mmdeposit", phone, amount, reference, reason });
        console.log("EasyPay response:", response);

        // Store transaction as pending
        req.app.locals.transactions.push({
            phone, reference, amount, type: "deposit", status: "pending", timestamp: new Date()
        });

        res.json(response);
    } catch (err) {
        res.status(500).json({ success: 0, errormsg: err.message });
    }
};

exports.withdraw = async (req, res) => {
    const { phone, amount, reference } = req.body;
    try {
        const response = await callEasyPay({ action: "mmpayout", phone, amount, reference });

        req.app.locals.transactions.push({
            phone, reference, amount, type: "withdraw", status: "pending", timestamp: new Date()
        });

        res.json(response);
    } catch (err) {
        res.status(500).json({ success: 0, errormsg: err.message });
    }
};

exports.status = async (req, res) => {
    const { reference } = req.params;
    try {
        const response = await callEasyPay({ action: "mmstatus", reference });
        res.json(response);
    } catch (err) {
        res.status(500).json({ success: 0, errormsg: err.message });
    }
};

// IPN callback – automatically update wallet & transaction
exports.ipn = (req, res) => {
    const io = req.app.get('io'); // ensure correct Socket.IO instance
    const data = req.body;

    const txIndex = req.app.locals.transactions.findIndex(t => t.reference === data.reference);
    if (txIndex !== -1) req.app.locals.transactions[txIndex].status = "success";

    if (!req.app.locals.wallets[data.phone]) req.app.locals.wallets[data.phone] = 0;
    req.app.locals.wallets[data.phone] += parseFloat(data.amount);

    io.to(data.phone).emit("walletUpdate", { phone: data.phone, balance: req.app.locals.wallets[data.phone], transaction: data });

    res.sendStatus(200);
};

