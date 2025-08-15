import RegValidationService from '../services/validation/RegValidationService.js';
import UserService from '../services/UserService.js';
import EmailService from '../services/EmailService.js';
import { ApiResponse } from '../utils/apiResponse.js';
import LoginValidationService from '../services/validation/LoginValidationService.js';
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.JWT_SECRET;
if (typeof JWT_SECRET !== 'string') {
  throw new Error('JWT_SECRET environment variable is not defined or not a string');
}
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not defined');
}


export const register = async (req, res) => {
    try {
      const { username, email, password, country } = req.body;

      const validation = RegValidationService.validateRegistrationData({
        username,
        email,
        password,
        country
      });

      if (!validation.isValid) {
        return ApiResponse.validationError(res, validation.errors);
      }

      const { validatedData } = validation;

      const userExistsCheck = await UserService.checkUserExists(
        validatedData.email,
        validatedData.username
      );

      if (userExistsCheck.exists) {
        return ApiResponse.conflict(res, userExistsCheck.message, {
          field: userExistsCheck.field
        });
      }

      const user = await UserService.createUser(validatedData);

      const verificationLink = UserService.generateVerificationLink(
        user.email,
        user.verificationToken
      );

      try {
        await EmailService.sendVerificationEmail(
          user.email,
          user.username,
          verificationLink
        );
        
        console.log(`Verification email sent to ${user.email}`);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        // todo: Queue in prod
      }

      return ApiResponse.success(res, {
        message: 'Registration successful. Please check your email to verify your account.',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstname: user.firstname,
          lastname: user.lastname,
          isverified: user.isverified
        }
      }, 201);

    } catch (error) {
      console.error('Registration error:', error);
      
      if (error.message.includes('already registered')) {
        return ApiResponse.conflict(res, error.message);
      }
      
      return ApiResponse.serverError(res, 'Registration failed. Please try again.');
    }
  }

export const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    const validation = LoginValidationService.validateLoginData({
      identifier,
      password
    });

    if (!validation.isValid) {
      return ApiResponse.validationError(res, validation.errors);
    }

    const { validatedData } = validation;

    let user;
    if (validatedData.isEmail) {
      user = await UserService.findUserByEmail(validatedData.identifier);
    } else {
      user = await UserService.findUserByUsername(validatedData.identifier);
    }

    if (!user) {
      return ApiResponse.unauthorized(res, 'Invalid login credentials');
    }

    const passwordMatch = await bcrypt.compare(validatedData.password, user.password);
    if (!passwordMatch) {
      return ApiResponse.unauthorized(res, 'Invalid login credentials');
    }

    if (!user.isverified) {
      return ApiResponse.forbidden(res, 'Please verify your email address first');
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    await UserService.updateLastLogin(user.id);

    return ApiResponse.success(res, {
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        isverified: user.isverified
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    return ApiResponse.serverError(res, 'Login failed. Please try again.');
  }
};

export const verifyEmail = async (req, res) => {
    try {
      const { email, token } = req.query;

      if (!email || !token) {
        return ApiResponse.badRequest(res, 'Email and verification token are required');
      }

      const result = await UserService.verifyEmailToken(email, token);

      if (result.success) {
        return ApiResponse.success(res, { message: result.message });
      } else {
        return ApiResponse.badRequest(res, result.message);
      }

    } catch (error) {
      console.error('Email verification error:', error);
      return ApiResponse.serverError(res, 'Email verification failed. Please try again.');
    }
  }

export async function resendVerification(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return ApiResponse.badRequest(res, 'Email is required');
      }

      const emailValidation = RegValidationService.validateEmail(email);
      if (!emailValidation.isValid) {
        return ApiResponse.badRequest(res, emailValidation.message);
      }

      const user = await UserService.findUserByEmail(email);

      if (!user) {
        return ApiResponse.notFound(res, 'User not found');
      }

      if (user.isverified) {
        return ApiResponse.badRequest(res, 'Email is already verified');
      }
      const now = new Date();
      const lastUpdated = new Date(user.updatedAt);
      const minutesSinceLastUpdate = (now - lastUpdated) / (1000 * 60);

      if (minutesSinceLastUpdate < 5 && user.verificationToken) {
        return ApiResponse.error(res, 
          'Please wait at least 5 minutes before requesting another verification email'
        );
      }

      let verificationToken = user.verificationToken;
      if (!verificationToken || minutesSinceLastUpdate >= 5) {
        verificationToken = UserService.generateVerificationToken();
        await user.update({ 
          verificationToken: verificationToken,
          updatedAt: now
        });
      }

      const verificationLink = UserService.generateVerificationLink(
        user.email,
        verificationToken
      );

      await EmailService.sendVerificationEmail(
        user.email,
        user.username,
        verificationLink
      );

      return ApiResponse.success(res, {
        message: 'Verification email resent successfully'
      });

    } catch (error) {
      console.error('Resend verification error:', error);
      return ApiResponse.serverError(res, 'Failed to resend verification email');
    }
  }