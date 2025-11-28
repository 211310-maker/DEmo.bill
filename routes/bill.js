const express = require('express');
const router = express.Router();


const {
  getDetails,
  createBill,
  getAllBills,
  getBillInPdfFormat,
  getBillOnPageFormat,
  verifyBill,
} = require('../controller/bill');

const { protect, adminOnly } = require('../middleware/auth');

//@desc    get details
//@route   GET /bill/:state/get-details/:vehicleNo
//@access  private
router.get('/get-details', protect, getDetails);

//@desc    get Pdf
//@route   GET /bill/:id/pdf
//@access  private
router.get('/:id/pdf', protect, getBillInPdfFormat);

//@desc    get bill details on page
//@route   GET /bill/:id/page
//@access  private
router.get('/:id/page', protect, getBillOnPageFormat);

//@desc    verify bill
//@route   GET /bill/verify/:id
//@access  private
router.get('/verify/:id', protect, verifyBill);

// get all with filter

//@desc    get all
//@route   GET /bill
//@access  private
router.get('/', protect, getAllBills);

//@desc    create bill
//@route   POST /bill
//@access  private
router.post('/', protect, createBill);

module.exports = router;
