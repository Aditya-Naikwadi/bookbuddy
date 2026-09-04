const mongoose = require('mongoose');
const Badge = require('../models/Badge');
const config = require('../config');

const initialBadges = [
  {
    key: 'streak_7',
    label: '7-Day Reading Streak',
    icon: 'flame-7',
    criteria: { type: 'streak', threshold: 7 },
    tier: 'bronze',
  },
  {
    key: 'streak_30',
    label: '30-Day Master Reader',
    icon: 'flame-30',
    criteria: { type: 'streak', threshold: 30 },
    tier: 'silver',
  },
  {
    key: 'first_review',
    label: 'First Reviewer',
    icon: 'star-1',
    criteria: { type: 'review', threshold: 1 },
    tier: 'bronze',
  },
  {
    key: 'first_list_created',
    label: 'Curator',
    icon: 'list-1',
    criteria: { type: 'list', threshold: 1 },
    tier: 'bronze',
  },
  {
    key: 'power_reader_10',
    label: 'Bookworm',
    icon: 'book-10',
    criteria: { type: 'books_read', threshold: 10 },
    tier: 'gold',
  },
];

const seedBadges = async () => {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.mongoUri);
    }

    for (const badgeData of initialBadges) {
      await Badge.findOneAndUpdate({ key: badgeData.key }, badgeData, {
        upsert: true,
        returnDocument: 'after',
      });
    }

    console.log('✅ Badges seeded successfully (upsert).');
  } catch (error) {
    console.error('❌ Failed to seed Badges:', error);
    throw error;
  }
};

if (require.main === module) {
  seedBadges().then(() => mongoose.connection.close());
}

module.exports = seedBadges;
