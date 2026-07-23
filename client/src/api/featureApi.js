import apiClient from './client';

export const featureApi = {
  // GET /api/colleges/available-services
  getAvailableServices: async () => {
    try {
      const { data } = await apiClient.get('/colleges/available-services');
      return data.data || data;
    } catch (err) {
      console.warn('Backend unavailable, using default available services list:', err);
      // Fallback service catalog
      return [
        {
          key: 'catalog',
          name: 'Catalog & Discovery',
          description: 'Search physical books, digital assets, and holdings across libraries.',
          category: 'Core',
          icon: 'Search',
          isCore: true,
        },
        {
          key: 'loans',
          name: 'Circulation & Loans',
          description: 'Manage checkouts, renewals, hold queues, and borrowing rules.',
          category: 'Core',
          icon: 'Library',
          isCore: true,
        },
        {
          key: 'patron-card',
          name: 'Digital Patron ID Card',
          description: 'NFC/QR-based mobile library pass for student authentication.',
          category: 'Core',
          icon: 'CreditCard',
          isCore: true,
        },
        {
          key: 'fines',
          name: 'Fines & Payments',
          description: 'Automated overdue fine calculation, payment gateway, and waivers.',
          category: 'Core',
          icon: 'Receipt',
        },
        {
          key: 'e-resources',
          name: 'E-Resources & E-Books',
          description: 'In-app EPUB/PDF digital reader with DRM access controls.',
          category: 'Engagement',
          icon: 'FileText',
        },
        {
          key: 'reading-lists',
          name: 'Course Reading Lists',
          description: 'Faculty-curated reading materials linked directly to syllabus.',
          category: 'Engagement',
          icon: 'ListPlus',
        },
        {
          key: 'recommendations',
          name: 'AI Recommendations',
          description: 'Personalized book recommendations based on study major and history.',
          category: 'Engagement',
          icon: 'Sparkles',
        },
        {
          key: 'gamification',
          name: 'Gamification & Badges',
          description: 'Reading streaks, badges, leaderboards, and reading achievements.',
          category: 'Engagement',
          icon: 'Award',
          dependencies: ['recommendations'],
        },
        {
          key: 'facilities',
          name: 'Facilities & Lab Booking',
          description: 'Reserve study pods, lab workstations, and discussion rooms.',
          category: 'Facilities',
          icon: 'Monitor',
          dependencies: ['support'],
        },
        {
          key: 'support',
          name: 'Support & Helpdesk',
          description: 'Student ticket system for librarian assistance and desk queries.',
          category: 'Facilities',
          icon: 'MessageSquare',
        },
        {
          key: 'analytics',
          name: 'Usage Analytics & Reports',
          description: 'College-wide circulation metrics, peak hours, and stock auditing.',
          category: 'Analytics',
          icon: 'LineChart',
        },
      ];
    }
  },

  // GET /api/college/:id/features or /api/colleges/my-features
  getCollegeFeatures: async (collegeId = 'current') => {
    try {
      const { data } = await apiClient.get(`/college/${collegeId}/features`);
      return data.data || data;
    } catch (err) {
      console.warn('Backend unavailable, using default college enabled features:', err);
      return {
        enabledFeatures: [
          'catalog',
          'loans',
          'fines',
          'patron-card',
          'e-resources',
          'reading-lists',
          'recommendations',
          'gamification',
          'saved',
          'facilities',
          'support',
          'analytics',
        ],
        limits: {
          maxStudents: 5000,
          storageGb: 50,
        },
      };
    }
  },

  // POST /api/college/:id/students/bulk-upload
  bulkUploadStudents: async (collegeId = 'current', formData) => {
    try {
      const { data } = await apiClient.post(`/college/${collegeId}/students/bulk-upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return data.data || data;
    } catch (err) {
      console.warn('Backend bulk upload call simulated:', err);
      return {
        jobId: `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        status: 'queued',
      };
    }
  },

  // GET /api/college/:id/students/upload/:jobId
  getUploadJobStatus: async (jobId, collegeId = 'current') => {
    try {
      const { data } = await apiClient.get(`/college/${collegeId}/students/upload/${jobId}`);
      return data.data || data;
    } catch (err) {
      console.warn('Simulated upload job status response:', err);
      return {
        jobId,
        status: 'completed',
        processed: 120,
        failed: 3,
        errors: [
          { row: 14, studentId: 'STU-1014', error: 'Email already exists in college database' },
          { row: 42, studentId: 'STU-1042', error: 'Invalid department code' },
          { row: 89, studentId: 'STU-1089', error: 'Missing student name' },
        ],
      };
    }
  },
};

export default featureApi;
