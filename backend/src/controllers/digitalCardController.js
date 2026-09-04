const jwt = require('jsonwebtoken');
const config = require('../config');

// GET /api/v1/digital-card/token - Issue signed time-bound QR token for patron checkin
const getDigitalCardToken = async (req, res, next) => {
  try {
    const user = req.user;

    const payload = {
      sub: user._id,
      collegeId: user.collegeId,
      rollNumber: user.rollNumber || '',
      type: 'patron_digital_qr',
    };

    // Short-lived 5-minute QR payload token for library scanner checkin security
    const token = jwt.sign(payload, config.jwtSecret, { expiresIn: '5m' });

    res.status(200).json({
      success: true,
      token,
      expiresInSeconds: 300,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        rollNumber: user.rollNumber || 'N/A',
        department: user.department || 'N/A',
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDigitalCardToken,
};
