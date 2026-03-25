// TypeScript interfaces for database tables in the Muhimmat system

// Interface for user table
export interface User {
    id: number;
    username: string;
    email: string;
    passwordHash: string;
    createdAt: Date;
    updatedAt: Date;
}

// Interface for task table
export interface Task {
    id: number;
    title: string;
    description: string;
    userId: number;
    status: 'pending' | 'in_progress' | 'completed';
    createdAt: Date;
    updatedAt: Date;
}

// Interface for project table
export interface Project {
    id: number;
    name: string;
    userId: number;
    createdAt: Date;
    updatedAt: Date;
}