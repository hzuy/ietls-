const express = require('express')
const router = express.Router()

router.use('/', require('./admin/uploads'))
router.use('/', require('./admin/examSeries'))
router.use('/', require('./admin/exams/core'))
router.use('/', require('./admin/exams/reading'))
router.use('/', require('./admin/exams/listening'))
router.use('/', require('./admin/exams/writing'))
router.use('/', require('./admin/exams/speaking'))
router.use('/', require('./admin/dashboard'))
router.use('/', require('./admin/users'))
router.use('/', require('./admin/trash'))

module.exports = router
