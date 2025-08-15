import RegValidationService from '../services/validation/RegValidationService.js';
import UserService from '../services/UserService.js';
import EmailService from '../services/EmailService.js';
import { ApiResponse } from '../utils/apiResponse.js';

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

      let verificationToken = user.verificationToken;
      if (!verificationToken) {
        verificationToken = UserService.generateVerificationToken();
        await user.update({ verificationToken });
      }

      const verificationLink = UserService.generateVerificationLink(
        user.email,
        verificationToken
      );

      await EmailService.sendVerificationEmail(
        user.email,
        user.firstname,
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