const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      minlength: [2, 'Username minlength should be 2'],
      unique: true,
    },
    role: {
      type: String,
      enum: ['member', 'admin'],
      default: 'member',
    },
    password: {
      type: String,
      minlength: [5, 'Username minlength should be 5'],
    },
    accessState: {
      type: [String],
      default: null,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    completed: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

UserSchema.virtual('createdBy', {
  ref: 'Bill',
  localField: '_id',
  foreignField: 'createdBy',
  strictPopulate: false,
  count: true,
});

UserSchema.methods.generateAuthToken = function () {
  return jwt.sign({ _id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

UserSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

module.exports = mongoose.model('User', UserSchema);
