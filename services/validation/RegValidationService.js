class RegValidationService {
  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!email) {
      return { isValid: false, message: 'Email is required' };
    }
    
    if (typeof email !== 'string') {
      return { isValid: false, message: 'Email must be a string' };
    }
    
    if (email.length > 254) {
      return { isValid: false, message: 'Email is too long (maximum 254 characters)' };
    }
    
    if (!emailRegex.test(email)) {
      return { isValid: false, message: 'Please provide a valid email address' };
    }
    
    return { isValid: true };
  }

  static validateUsername(username) {
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    
    if (!username) {
      return { isValid: false, message: 'Username is required' };
    }
    
    if (typeof username !== 'string') {
      return { isValid: false, message: 'Username must be a string' };
    }
    
    if (username.length < 3) {
      return { isValid: false, message: 'Username must be at least 3 characters long' };
    }
    
    if (username.length > 30) {
      return { isValid: false, message: 'Username must not be more than 30 characters long' };
    }
    
    if (!usernameRegex.test(username)) {
      return { isValid: false, message: 'Username can only contain letters, numbers, and underscores' };
    }
    
    return { isValid: true };
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
    
    if (!/[a-z]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one lowercase letter' };
    }
    
    if (!/[A-Z]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one uppercase letter' };
    }
    
    if (!/\d/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one number' };
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one special character' };
    }
    
    return { isValid: true };
  }

  static validateName(name, fieldName = 'Name') {
    if (!name) {
      return { isValid: false, message: `${fieldName} is required` };
    }
    
    if (typeof name !== 'string') {
      return { isValid: false, message: `${fieldName} must be a string` };
    }
    
    const trimmedName = name.trim();
    
    if (trimmedName.length < 2) {
      return { isValid: false, message: `${fieldName} must be at least 2 characters long` };
    }
    
    if (trimmedName.length > 50) {
      return { isValid: false, message: `${fieldName} must be at most 50 characters long` };
    }
    
    // Allow letters, spaces, hyphens, and apostrophes
    const nameRegex = /^[a-zA-Z\s\-']+$/;
    if (!nameRegex.test(trimmedName)) {
      return { isValid: false, message: `${fieldName} can only contain letters, spaces, hyphens, and apostrophes` };
    }
    
    return { isValid: true, value: trimmedName };
  }

  static validateRegistrationData({ username, email, password }) {
    const errors = [];
    const validatedData = {};

    // Validate firstname
    // const firstnameValidation = this.validateName(firstname, 'First name');
    // if (!firstnameValidation.isValid) {
    //   errors.push({ field: 'firstname', message: firstnameValidation.message });
    // } else {
    //   validatedData.firstname = firstnameValidation.value;
    // }

    // // Validate lastname
    // const lastnameValidation = this.validateName(lastname, 'Last name');
    // if (!lastnameValidation.isValid) {
    //   errors.push({ field: 'lastname', message: lastnameValidation.message });
    // } else {
    //   validatedData.lastname = lastnameValidation.value;
    // }

    // Validate username
    const usernameValidation = this.validateUsername(username);
    if (!usernameValidation.isValid) {
      errors.push({ field: 'username', message: usernameValidation.message });
    } else {
      validatedData.username = username.toLowerCase().trim();
    }

    // Validate email
    const emailValidation = this.validateEmail(email);
    if (!emailValidation.isValid) {
      errors.push({ field: 'email', message: emailValidation.message });
    } else {
      validatedData.email = email.toLowerCase().trim();
    }

    // Validate password
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

export default RegValidationService;