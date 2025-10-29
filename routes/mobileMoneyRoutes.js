const express = require("express");
const router = express.Router();
const { deposit, withdraw, status, ipn } = require("../controllers/mobileMoneyController");

router.post("/deposit", deposit);
router.post("/withdraw", withdraw);
router.get("/status/:reference", status);
router.post("/ipn", ipn);

router.get("/wallet/:phone", (req, res) => {
    const balance = req.app.locals.wallets[req.params.phone] || 0;
    res.json({ balance });
});

router.get("/transactions/:phone", (req, res) => {
    const userTx = req.app.locals.transactions.filter(t => t.phone === req.params.phone);
    res.json({ transactions: userTx });
});


module.exports = router;
