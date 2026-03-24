// accountAssignmentService.ts

interface Assignment {
    id: number;
    userId: number;
    status: 'open' | 'closed';
    createdAt: Date;
    updatedAt: Date;
}

let assignments: Assignment[] = [];

/**
 * Retrieves all open assignments.
 * @returns Array of open assignments.
 */
function getOpenAssignments(): Assignment[] {
    return assignments.filter(assignment => assignment.status === 'open');
}

/**
 * Closes all open assignments.
 */
function closeOpenAssignments(): void {
    assignments.forEach(assignment => {
        if (assignment.status === 'open') {
            assignment.status = 'closed';
            assignment.updatedAt = new Date();
        }
    });
}

/**
 * Creates a new assignment.
 * @param userId - The ID of the user to assign.
 * @returns The created assignment.
 */
function createAssignment(userId: number): Assignment {
    const newAssignment: Assignment = {
        id: assignments.length + 1,
        userId,
        status: 'open',
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    assignments.push(newAssignment);
    return newAssignment;
}

/**
 * Updates an existing assignment.
 * @param id - The ID of the assignment to update.
 * @param userId - The new user ID to assign (optional).
 * @param status - The new status ('open' or 'closed') (optional).
 */
function updateAssignment(id: number, userId?: number, status?: 'open' | 'closed'): void {
    const assignment = assignments.find(a => a.id === id);
    if (assignment) {
        if (userId !== undefined) {
            assignment.userId = userId;
        }
        if (status !== undefined) {
            assignment.status = status;
        }
        assignment.updatedAt = new Date();
    }
}

export { getOpenAssignments, closeOpenAssignments, createAssignment, updateAssignment };