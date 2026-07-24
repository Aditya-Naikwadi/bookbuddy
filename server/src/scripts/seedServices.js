const mongoose = require('mongoose');
const Service = require('../models/Service');
const config = require('../config');

const defaultServices = [
  {
    key: 'catalog_management',
    name: 'Catalog Management & Search',
    description: 'Core physical book cataloging, search, borrowing, and inventory management.',
    category: 'core',
    dependsOn: [],
    isActive: true,
  },
  {
    key: 'facilities_booking',
    name: 'Facilities & Lab Booking',
    description: 'Study space, research lab, and facility slot reservation engine.',
    category: 'facilities',
    dependsOn: [],
    isActive: true,
  },
  {
    key: 'gamification',
    name: 'Reading Streaks & Gamification',
    description: 'Milestone badges, streak tracking, reading rewards, and digital stickers.',
    category: 'engagement',
    dependsOn: ['catalog_management'],
    isActive: true,
  },
  {
    key: 'eresources',
    name: 'Digital Assets & E-Resources',
    description: 'EPUB/PDF reader, digital subscriptions, and online repository access.',
    category: 'engagement',
    dependsOn: [],
    isActive: true,
  },
  {
    key: 'analytics',
    name: 'Advanced Library Analytics',
    description: 'Patron usage trends, inventory metrics, and financial report dashboards.',
    category: 'analytics',
    dependsOn: [],
    isActive: true,
  },
];

const seedServices = async () => {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.mongoUri);
    }

    for (const serviceData of defaultServices) {
      await Service.findOneAndUpdate({ key: serviceData.key }, serviceData, {
        upsert: true,
        new: true,
      });
    }

    // eslint-disable-next-line no-console
    console.log('✅ Service Catalog seeded successfully.');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('❌ Failed to seed Service Catalog:', error);
  }
};

if (require.main === module) {
  seedServices().then(() => mongoose.connection.close());
}

module.exports = seedServices;
