// Removed 'as any' type assertions and used proper typing

interface Filters {
    city: string; // replace 'string' with the actual type if available
    // ... other properties
}

const filters: Filters = { // Ensure to initialize filters correctly
    city: 'some city', // Example city
    // ... other properties
};

// Rest of the code continues...