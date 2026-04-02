'use strict';
const CartService = require('./cart.service');
const { success } = require('../../utils/response');

const getSessionId = (req) => {
    return req.headers['x-session-id'] || req.cookies?.sessionId || null;
};

const getCart = async (req, res, next) => {
    try {
        const userId = req.user ? req.user.id : null;
        const sessionId = getSessionId(req);
        const cart = await CartService.getCart(userId, sessionId);
        return success(res, cart, 'Cart fetched');
    } catch (err) { next(err); }
};

const addItem = async (req, res, next) => {
    try {
        const userId = req.user ? req.user.id : null;
        const sessionId = getSessionId(req);
        const cart = await CartService.addItem(userId, sessionId, req.validated);
        return success(res, cart, 'Item added to cart', 201);
    } catch (err) { next(err); }
};

const updateItem = async (req, res, next) => {
    try {
        const userId = req.user ? req.user.id : null;
        const sessionId = getSessionId(req);
        const cart = await CartService.updateItem(userId, sessionId, req.params.id, req.validated.quantity);
        return success(res, cart, 'Item updated');
    } catch (err) { next(err); }
};

const removeItem = async (req, res, next) => {
    try {
        const userId = req.user ? req.user.id : null;
        const sessionId = getSessionId(req);
        const cart = await CartService.removeItem(userId, sessionId, req.params.id);
        return success(res, cart, 'Item removed from cart');
    } catch (err) { next(err); }
};

const clearCart = async (req, res, next) => {
    try {
        const userId = req.user ? req.user.id : null;
        const sessionId = getSessionId(req);
        await CartService.clearCart(userId, sessionId);
        return success(res, null, 'Cart cleared');
    } catch (err) { next(err); }
};

const mergeGuestCart = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { sessionId } = req.validated;
        const cart = await CartService.mergeGuestCart(sessionId, userId);
        return success(res, cart, 'Carts merged');
    } catch (err) { next(err); }
};

module.exports = {
    getCart,
    addItem,
    updateItem,
    removeItem,
    clearCart,
    mergeGuestCart
};
