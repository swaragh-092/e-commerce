const fs = require('fs');
const path = require('path');

const pageFile = path.join(__dirname, 'client/src/pages/storefront/PaymentPage.jsx');
let code = fs.readFileSync(pageFile, 'utf8');

// Intercept stripe return
if (!code.includes("returnedProvider === 'stripe'")) {
    code = code.replace(
        `if (returnedProvider === 'cashfree') {`,
        `if (returnedProvider === 'stripe') {
            paymentService.verifyPayment(orderId, { provider: 'stripe', session_id: query.get('session_id') })
                .then((res) => {
                    const result = res.data?.data || res.data;
                    if (result?.success) {
                        navigate('/payment/success', { replace: true, state: { orderId } });
                    } else {
                        navigate('/payment/failure', { replace: true, state: { orderId, status: result?.status } });
                    }
                })
                .catch((err) => setError(getApiErrorMessage(err, 'Payment verification failed.')))
                .finally(() => setLoading(false));
            return;
        }

        if (returnedProvider === 'cashfree') {`
    );
}

// Handle Stripe payment trigger
const stripeHandler = `
    const handleStripePayment = () => {
        if (!orderData?.url) {
            setError('Stripe payment session is not ready. Please try again.');
            return;
        }
        setProcessing(true);
        window.location.href = orderData.url;
    };
`;
if (!code.includes('handleStripePayment')) {
    code = code.replace(
        'const handleCashfreePayment = async () => {',
        `${stripeHandler}\n    const handleCashfreePayment = async () => {`
    );
}

// Handle PayU payment trigger
const payuHandler = `
    const handlePayUPayment = () => {
        if (!orderData?.action || !orderData?.fields) {
            setError('PayU payment session is not ready. Please try again.');
            return;
        }
        setProcessing(true);
        
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = orderData.action;

        Object.keys(orderData.fields).forEach(key => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = orderData.fields[key];
            form.appendChild(input);
        });

        document.body.appendChild(form);
        form.submit();
    };
`;
if (!code.includes('handlePayUPayment')) {
    code = code.replace(
        'const handlePayment = () => {',
        `${payuHandler}\n    const handlePayment = () => {`
    );
}

// Update handlePayment
code = code.replace(
    `if (orderData?.provider === 'cashfree' || order?.paymentMethod === 'cashfree') {
            handleCashfreePayment();
            return;
        }`,
    `if (orderData?.provider === 'cashfree' || order?.paymentMethod === 'cashfree') {
            handleCashfreePayment();
            return;
        }
        if (orderData?.provider === 'stripe' || order?.paymentMethod === 'stripe') {
            handleStripePayment();
            return;
        }
        if (orderData?.provider === 'payu' || order?.paymentMethod === 'payu') {
            handlePayUPayment();
            return;
        }`
);

fs.writeFileSync(pageFile, code);
console.log('Patched PaymentPage.jsx');
