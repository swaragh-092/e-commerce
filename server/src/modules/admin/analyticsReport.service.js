'use strict';

const AnalyticsService = require('./analytics.service');
const AdminService = require('./admin.service');
const SettingsService = require('../settings/settings.service');
const emailChannel = require('../notification/channels/email.channel');
const logger = require('../../utils/logger');

const formatPrice = (amount) => {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
};

const renderReportHtml = (data, period) => {
  const { stats, topProducts, conversionRate, repeatCustomers, abandonedCarts } = data;
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const productRows = (topProducts || []).slice(0, 5).map((p, i) => `
    <tr style="border-bottom:1px solid #eee;">
      <td style="padding:8px;">${i + 1}</td>
      <td style="padding:8px;">${p.name}</td>
      <td style="padding:8px;text-align:right;">${formatPrice(p.revenue)}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
  <div style="background:#1976d2;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;">
    <h1 style="margin:0;font-size:20px;">Analytics Report</h1>
    <p style="margin:4px 0 0;opacity:0.9;font-size:14px;">${date} — Last ${period}</p>
  </div>

  <div style="background:#f9f9f9;padding:20px;border:1px solid #e0e0e0;border-top:none;">
    <h2 style="font-size:16px;margin-top:0;">Key Metrics</h2>
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:10px;background:#fff;border-radius:4px;text-align:center;width:25%;">
          <div style="font-size:24px;font-weight:700;color:#1976d2;">${formatPrice(stats?.totalRevenue || 0)}</div>
          <div style="font-size:12px;color:#666;">Revenue</div>
        </td>
        <td style="width:8px;"></td>
        <td style="padding:10px;background:#fff;border-radius:4px;text-align:center;width:25%;">
          <div style="font-size:24px;font-weight:700;color:#2e7d32;">${stats?.totalOrders || 0}</div>
          <div style="font-size:12px;color:#666;">Orders</div>
        </td>
        <td style="width:8px;"></td>
        <td style="padding:10px;background:#fff;border-radius:4px;text-align:center;width:25%;">
          <div style="font-size:24px;font-weight:700;color:#ed6c02;">${conversionRate?.rate || 0}%</div>
          <div style="font-size:12px;color:#666;">Conversion</div>
        </td>
        <td style="width:8px;"></td>
        <td style="padding:10px;background:#fff;border-radius:4px;text-align:center;width:25%;">
          <div style="font-size:24px;font-weight:700;color:#9c27b0;">${repeatCustomers?.rate || 0}%</div>
          <div style="font-size:12px;color:#666;">Repeat Rate</div>
        </td>
      </tr>
    </table>

    ${abandonedCarts?.rate ? `
    <div style="margin-top:16px;padding:12px;background:#fff3e0;border-radius:4px;border-left:4px solid #ed6c02;">
      <strong>Cart Abandonment:</strong> ${abandonedCarts.rate}% (${abandonedCarts.abandoned} of ${abandonedCarts.total} carts)
    </div>` : ''}

    <h2 style="font-size:16px;margin-top:20px;">Top Products by Revenue</h2>
    ${productRows ? `
    <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:4px;">
      <thead>
        <tr style="background:#f5f5f5;">
          <th style="padding:8px;text-align:left;font-size:12px;">#</th>
          <th style="padding:8px;text-align:left;font-size:12px;">Product</th>
          <th style="padding:8px;text-align:right;font-size:12px;">Revenue</th>
        </tr>
      </thead>
      <tbody>${productRows}</tbody>
    </table>` : '<p style="color:#666;">No sales data for this period.</p>'}
  </div>

  <div style="padding:12px 20px;text-align:center;font-size:11px;color:#999;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px;">
    Auto-generated report from your store admin panel.
  </div>
</body>
</html>`;
};

const getReportData = async (period = '7d') => {
  const [stats, topProducts, conversionRate, repeatCustomers, abandonedCarts] = await Promise.allSettled([
    AdminService.getStats(),
    AnalyticsService.getTopProducts({ period, limit: 5, sortBy: 'revenue' }),
    AnalyticsService.getConversionRate({ period }),
    AnalyticsService.getRepeatCustomers({ period }),
    AnalyticsService.getAbandonedCarts({ period }),
  ]);

  return {
    stats: stats.status === 'fulfilled' ? stats.value : null,
    topProducts: topProducts.status === 'fulfilled' ? topProducts.value : [],
    conversionRate: conversionRate.status === 'fulfilled' ? conversionRate.value : null,
    repeatCustomers: repeatCustomers.status === 'fulfilled' ? repeatCustomers.value : null,
    abandonedCarts: abandonedCarts.status === 'fulfilled' ? abandonedCarts.value : null,
  };
};

const sendReport = async () => {
  try {
    const reportSettings = await SettingsService.getByGroup('analytics_reports');
    if (!reportSettings || reportSettings.enabled !== 'true') {
      logger.info('Analytics reports disabled, skipping.');
      return;
    }

    const recipients = (reportSettings.recipients || '').split(',').map(e => e.trim()).filter(Boolean);
    if (recipients.length === 0) {
      logger.warn('Analytics report: no recipients configured.');
      return;
    }

    const period = reportSettings.period || '7d';
    const data = await getReportData(period);
    const html = renderReportHtml(data, period);

    for (const to of recipients) {
      await emailChannel.send({
        to,
        subject: `Analytics Report — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        html,
        text: `Analytics Report for last ${period}. Revenue: ${formatPrice(data.stats?.totalRevenue || 0)}, Orders: ${data.stats?.totalOrders || 0}.`,
      });
    }

    logger.info(`Analytics report sent to ${recipients.length} recipient(s).`);
  } catch (error) {
    logger.error('Error sending analytics report:', error);
  }
};

module.exports = { sendReport, getReportData, renderReportHtml };
