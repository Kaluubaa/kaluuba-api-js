class LoginValidationService {
  static validateLoginIdentifier(identifier) {
    if (!identifier) {
      return { isValid: false, message: 'Email or username is required' };
    }
    
    if (typeof identifier !== 'string') {
      return { isValid: false, message: 'Identifier must be a string' };
    }
    
    const trimmedIdentifier = identifier.trim();
    
    if (trimmedIdentifier.length < 3) {
      return { isValid: false, message: 'Identifier must be at least 3 characters long' };
    }
    
    if (trimmedIdentifier.length > 254) {
      return { isValid: false, message: 'Identifier is too long' };
    }
    
    return { isValid: true, value: trimmedIdentifier.toLowerCase() };
  }

  static validatePassword(password) {
    if (!password) {
      return { isValid: false, message: 'Password is required' };
    }
    
    if (typeof password !== 'string') {
      return { isValid: false, message: 'Password must be a string' };
    }
    
    if (password.length < 8) {
      return { isValid: false, message: 'Password must be at least 8 characters long' };
    }
    
    if (password.length > 128) {
      return { isValid: false, message: 'Password is too long (maximum 128 characters)' };
    }
    
    return { isValid: true };
  }

  static validateLoginData({ identifier, password }) {
    const errors = [];
    const validatedData = {};

    const identifierValidation = this.validateLoginIdentifier(identifier);
    if (!identifierValidation.isValid) {
      errors.push({ field: 'identifier', message: identifierValidation.message });
    } else {
      validatedData.identifier = identifierValidation.value;
      
      // Detect if identifier is email or username
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(identifierValidation.value)) {
        validatedData.isEmail = true;
      } else {
        validatedData.isEmail = false;
      }
    }

    const passwordValidation = this.validatePassword(password);
    if (!passwordValidation.isValid) {
      errors.push({ field: 'password', message: passwordValidation.message });
    } else {
      validatedData.password = password;
    }

    return {
      isValid: errors.length === 0,
      errors,
      validatedData
    };
  }
}

export default LoginValidationService;