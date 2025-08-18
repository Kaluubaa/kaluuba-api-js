import jwt from 'jsonwebtoken';
import { ApiResponse } from '../utils/apiResponse.js';

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return ApiResponse.unauthorized(res, 'Access denied. No token provided.');
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return ApiResponse.unauthorized(res, 'Session expired. Please log in again.');
            }
            if (err.name === 'JsonWebTokenError') {
                return ApiResponse.unauthorized(res, 'Invalid authentication token.');
            }
            return ApiResponse.unauthorized(res, 'Unable to authenticate token.');
        }

        req.user = decoded.user || decoded;
        console.log('Decoded JWT:', decoded);
        
        if (decoded.exp && Date.now() >= decoded.exp * 1000) {
            return ApiResponse.unauthorized(res, 'Session expired. Please log in again.');
        }

        console.log('Attached user to request:', req.user);
        
        next();
    });
}

export default authenticateToken;