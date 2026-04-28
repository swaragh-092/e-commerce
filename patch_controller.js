const fs = require('fs');
const path = require('path');

// Update payment.controller.js
const controllerFile = path.join(__dirname, 'server/src/modules/payment/payment.controller.js');
let controllerCode = fs.readFileSync(controllerFile, 'utf8');

if (!controllerCode.includes('handleStripeWebhook')) {
    const hooks = `
const handleStripeWebhook = async (req, res, next) => {
    try {
        const signature = req.headers['stripe-signature'];
        const result = await PaymentService.handleStripeWebhook(req.body, signature);
        return success(res, result, 'Stripe webhook processed');
    } catch (err) { next(err); }
};

const handlePayUReturn = async (req, res, next) => {
    try {
        const result = await PaymentService.handlePayUReturn(req.body);
        const appUrl = process.env.CLIENT_URL?.split(',')[0] || process.env.APP_URL || 'http://localhost:3000';
        if (result.success) {
            res.redirect(\`\${appUrl}/payment/success?orderId=\${result.orderId}\`);
        } else {
            res.redirect(\`\${appUrl}/payment/failure?orderId=\${result.orderId}&status=\${result.status}\`);
        }
    } catch (err) { 
        console.error(err);
        res.redirect('/payment/failure');
    }
};
`;
    controllerCode = controllerCode.replace(
        'const confirmCodPayment = async (req, res, next) => {',
        `${hooks}\nconst confirmCodPayment = async (req, res, next) => {`
    );

    controllerCode = controllerCode.replace(
        'module.exports = { createOrder, verifyPayment, handleWebhook, handleCashfreeWebhook, confirmCodPayment, getGatewayStatuses, saveGatewayCredentials };',
        'module.exports = { createOrder, verifyPayment, handleWebhook, handleCashfreeWebhook, handleStripeWebhook, handlePayUReturn, confirmCodPayment, getGatewayStatuses, saveGatewayCredentials };'
    );
    fs.writeFileSync(controllerFile, controllerCode);
    console.log('Patched payment.controller.js');
}

// Update payment.routes.js
const routesFile = path.join(__dirname, 'server/src/modules/payment/payment.routes.js');
let routesCode = fs.readFileSync(routesFile, 'utf8');

if (!routesCode.includes('handleStripeWebhook')) {
    routesCode = routesCode.replace(
        '// Razorpay webhook',
        `// Stripe webhook
router.post('/webhook/stripe', paymentController.handleStripeWebhook);

// PayU return
router.post('/payu/return', paymentController.handlePayUReturn);

// Razorpay webhook`
    );
    fs.writeFileSync(routesFile, routesCode);
    console.log('Patched payment.routes.js');
}
