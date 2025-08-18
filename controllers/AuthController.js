import RegValidationService from '../services/validation/RegValidationService.js';
import UserService from '../services/UserService.js';
import EmailService from '../services/EmailService.js';
import { ApiResponse } from '../utils/apiResponse.js';
import LoginValidationService from '../services/validation/LoginValidationService.js';
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"

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

      try {
        await EmailService.sendVerificationEmail(
          user.email,
          user.username,
          user.verificationToken
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

    const token = generateJwtToken(user)

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
      const { email, otp } = req.body;

      if (!email || !otp) {
        return ApiResponse.badRequest(res, 'Email and verification OTP are required');
      }

      const result = await UserService.verifyEmailToken(email, otp);

      if (result.success) {
        const token = generateJwtToken(result.user)
        return ApiResponse.success(res, { 
            message: result.message,
            token: token
         });
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
        verificationToken = UserService.generateOTP();
        await user.update({ 
          verificationToken: verificationToken,
          updatedAt: now
        });
      }

      await EmailService.sendVerificationEmail(
        user.email,
        user.username,
        user.verificationToken
      );

      return ApiResponse.success(res, {
        message: 'Verification email resent successfully'
      });

    } catch (error) {
      console.error('Resend verification error:', error);
      return ApiResponse.serverError(res, 'Failed to resend verification email');
    }
  }

export const setPin = async (req, res) => {
  try {
    const userId = req.user.id;
    const { password, pin } = req.body;

    if (!pin || !password) {
        console.log("inside==================>")
      return ApiResponse.badRequest(res, 'PIN and password are required');
    }

    await UserService.setUserPin(userId, password, pin);
    return ApiResponse.success(res, { message: 'PIN set successfully' });

  } catch (error) {
    console.error('Set PIN error:', error);
    if (error.message.includes('Invalid password') || 
        error.message.includes('PIN must be')) {
      return ApiResponse.badRequest(res, error.message);
    }
    return ApiResponse.serverError(res, 'Failed to set PIN');
  }
};

export const updatePin = async (req, res) => {
  try {
    const { currentPin, newPin, password } = req.body;
    const userId = req.user.id;

    if (!currentPin || !newPin || !password) {
      return ApiResponse.badRequest(res, 'Current PIN, new PIN and password are required');
    }

    const pinValid = await UserService.verifyUserPin(userId, password, currentPin);
    if (!pinValid) {
      return ApiResponse.unauthorized(res, 'Invalid current PIN');
    }

    await UserService.updateUserPin(userId, password, newPin);
    return ApiResponse.success(res, { message: 'PIN updated successfully' });

  } catch (error) {
    console.error('Update PIN error:', error);
    if (error.message.includes('Invalid password') || 
        error.message.includes('PIN must be')) {
      return ApiResponse.badRequest(res, error.message);
    }
    return ApiResponse.serverError(res, 'Failed to update PIN');
  }
};

export const verifyPin = async (req, res) => {
  try {
    const { pin, password } = req.body;
    const userId = req.user.id;

    if (!pin || !password) {
      return ApiResponse.badRequest(res, 'PIN and password are required');
    }

    const isValid = await UserService.verifyUserPin(userId, password, pin);
    if (!isValid) {
      return ApiResponse.unauthorized(res, 'Invalid PIN');
    }

    return ApiResponse.success(res, { message: 'PIN verified successfully' });

  } catch (error) {
    console.error('Verify PIN error:', error);
    return ApiResponse.serverError(res, 'Failed to verify PIN');
  }
};

  // helpers
  function generateJwtToken(user) {
    const JWT_SECRET = process.env.JWT_SECRET;
    if (typeof JWT_SECRET !== 'string') {
    throw new Error('JWT_SECRET environment variable is not defined or not a string');
    }
    if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not defined');
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    return token
  }