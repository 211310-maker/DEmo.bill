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
//@access  public
router.get('/:id/pdf', getBillInPdfFormat);

//@desc    get bill details on page
//@route   GET /bill/:id/page
//@access  public
router.get('/:id/page', getBillOnPageFormat);

//@desc    verify bill
//@route   GET /bill/verify/:id
//@access  public
router.get('/verify/:id', verifyBill);

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
