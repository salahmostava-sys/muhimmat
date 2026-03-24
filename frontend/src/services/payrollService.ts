// payrollService.ts

/**
 * Calculate order based salary
 * @param {number} orderAmount - The amount of the order
 * @param {number} rate - The rate of salary per order
 * @returns {number} - The calculated salary
 */
function calcOrderBasedSalary(orderAmount, rate) {
    return orderAmount * rate;
}

/**
 * Calculate fixed monthly salary
 * @param {number} baseSalary - The base salary per month
 * @returns {number} - The fixed monthly salary
 */
function calcFixedMonthlySalary(baseSalary) {
    return baseSalary;
}

/**
 * Compute salary row for an employee
 * @param {Object} employee - The employee object
 * @param {number} orderAmount - The amount of orders completed
 * @param {number} orderRate - The rate of salary per order
 * @returns {Object} - The computed salary row
 */
function computeSalaryRow(employee, orderAmount, orderRate) {
    const orderBasedSalary = calcOrderBasedSalary(orderAmount, orderRate);
    const fixedMonthlySalary = calcFixedMonthlySalary(employee.baseSalary);
    return {
        employeeId: employee.id,
        employeeName: employee.name,
        totalSalary: orderBasedSalary + fixedMonthlySalary,
    };
}

module.exports = { calcOrderBasedSalary, calcFixedMonthlySalary, computeSalaryRow };