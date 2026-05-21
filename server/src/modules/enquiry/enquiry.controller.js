'use strict';

const enquiryService = require('./enquiry.service');
const { success, error, paginated } = require('../../utils/response');
const AppError = require('../../utils/AppError');

exports.createEnquiry = async (req, res, next) => {
  try {
    const data = req.body;
    const userId = req.user?.id || null;
    const enquiry = await enquiryService.createEnquiry(data, userId);
    return success(res, { enquiry }, 'Enquiry submitted successfully', 201);
  } catch (err) {
    next(err);
  }
};

exports.getEnquiries = async (req, res, next) => {
  try {
    const filters = {
      status: req.query.status,
      search: req.query.search,
      sortBy: req.query.sortBy,
      sortDir: req.query.sortDir,
    };
    const pagination = {
      page: req.query.page,
      limit: req.query.limit,
    };

    const result = await enquiryService.getEnquiries(filters, pagination);
    return paginated(
      res,
      result.data,
      result.meta.total,
      result.meta.page,
      result.meta.limit,
      'Enquiries retrieved successfully'
    );
  } catch (err) {
    next(err);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      throw new AppError('VALIDATION_ERROR', 400, 'Status is required');
    }

    const enquiry = await enquiryService.updateStatus(id, status);
    return success(res, { enquiry }, 'Enquiry status updated');
  } catch (err) {
    next(err);
  }
};

exports.replyEnquiry = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { replyMessage } = req.body;
    const adminUserId = req.user?.id || null;

    const trimmedReply = typeof replyMessage === 'string' ? replyMessage.trim() : '';
    if (!trimmedReply) {
      throw new AppError('VALIDATION_ERROR', 400, 'Reply message is required');
    }

    const enquiry = await enquiryService.replyToEnquiry(id, trimmedReply, adminUserId);
    return success(res, { enquiry }, 'Reply sent successfully');
  } catch (err) {
    next(err);
  }
};
