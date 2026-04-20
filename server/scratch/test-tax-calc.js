const { computeItemTax, getEffectiveTax } = require('../src/modules/tax/tax.service');

const runTests = () => {
    console.log('--- Running Tax Calculation Tests ---\n');

    const testCases = [
        {
            name: 'Intra-state GST (9% + 9%)',
            effectiveTax: { useGST: true, sgst: 9, cgst: 9, igst: 18, inclusive: false },
            subtotal: 100,
            destination: 'State A',
            origin: 'State A',
            expected: { totalTax: 18, sgst: 9, cgst: 9 }
        },
        {
            name: 'Inter-state GST (18%)',
            effectiveTax: { useGST: true, sgst: 9, cgst: 9, igst: 18, inclusive: false },
            subtotal: 100,
            destination: 'State B',
            origin: 'State A',
            expected: { totalTax: 18, igst: 18 }
        },
        {
            name: 'Flat Tax (10%)',
            effectiveTax: { useGST: false, flatRate: 10, inclusive: false },
            subtotal: 100,
            destination: 'State A',
            origin: 'State A',
            expected: { totalTax: 10, flatTax: 10 }
        },
        {
            name: 'Rounding Discrepancy Case (12% tax)',
            // 1.2348 + 1.2348 -> Total 2.47 if rounded from raw (2.4696)
            // But we want sum of rounded components: 1.23 + 1.23 = 2.46
            effectiveTax: { useGST: true, sgst: 12, cgst: 12, igst: 24, inclusive: false },
            subtotal: 10.29,
            destination: 'State A',
            origin: 'State A',
            expected: { sgst: 1.23, cgst: 1.23, totalTax: 2.46 }
        },
        {
            name: 'Custom Flat Rate Support',
            effectiveTax: getEffectiveTax({ taxConfig: { isCustom: true, flatRate: 5, inclusive: false } }, {}),
            subtotal: 100,
            destination: 'State A',
            origin: 'State A',
            expected: { totalTax: 5, flatTax: 5, isInclusive: false }
        }
    ];

    testCases.forEach(tc => {
        const result = computeItemTax(tc.effectiveTax, tc.subtotal, tc.destination, tc.origin);
        console.log(`Test: ${tc.name}`);
        console.log(`Input: ${JSON.stringify(tc.effectiveTax)}, Subtotal: ${tc.subtotal}`);
        console.log(`Result: ${JSON.stringify(result)}`);
        
        let passed = true;
        Object.keys(tc.expected).forEach(key => {
            const exp = tc.expected[key];
            const res = result[key];
            const isMatch = (typeof exp === 'number' && typeof res === 'number') 
                ? Math.abs(res - exp) < 0.0001
                : res === exp;
                
            if (!isMatch) {
                console.error(`  FAILED: ${key} expected ${exp}, got ${res}`);
                passed = false;
            }
        });
        
        if (passed) console.log('  PASSED');
        console.log('');
    });
};

runTests();
