// validation.ts

// Function to validate file uploads
function validateFileUpload(file) {
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    return allowedTypes.includes(file.type) && file.size <= 10485760; // 10 MB
}

// Function to validate phone numbers (US format)
function validatePhoneNumber(phoneNumber) {
    const regex = /^\(\d{3}\) \d{3}-\d{4}$/;
    return regex.test(phoneNumber);
}

// Function to validate emails
function validateEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

// Function to validate national IDs
function validateNationalID(nationalID) {
    const regex = /^[0-9]{4}-[0-9]{4}$/; // Example format: 1234-5678
    return regex.test(nationalID);
}

export { validateFileUpload, validatePhoneNumber, validateEmail, validateNationalID };