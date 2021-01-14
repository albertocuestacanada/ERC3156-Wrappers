const FlashMinter = artifacts.require('FlashMinterMock')
const FlashBorrower = artifacts.require('FlashBorrower')

const { BN, expectRevert } = require('@openzeppelin/test-helpers')
require('chai').use(require('chai-as-promised')).should()

const MAX = '115792089237316195423570985008687907853269984665640564039457584007913129639935'

contract('FlashMinter', (accounts) => {
  const [deployer, user1] = accounts
  let lender
  let borrower
  let weth

  beforeEach(async () => {
    weth = await FlashMinter.new("Test", "TST", 1000)
    lender = weth
    borrower = await FlashBorrower.new()
  })

  it('should do a simple flash loan', async () => {
    await borrower.flashBorrow(lender.address, weth.address, 1, { from: user1 })

    const balanceAfter = await lender.balanceOf(user1)
    balanceAfter.toString().should.equal(new BN('0').toString())
    const flashBalance = await borrower.flashBalance()
    flashBalance.toString().should.equal(new BN('1').toString())
    const flashToken = await borrower.flashToken()
    flashToken.toString().should.equal(weth.address)
    const flashAmount = await borrower.flashAmount()
    flashAmount.toString().should.equal(new BN('1').toString())
    const flashSender = await borrower.flashSender()
    flashSender.toString().should.equal(borrower.address)
  })

  it('should do a loan that pays fees', async () => {
    const loan = new BN('1000')
    const fee = await lender.flashFee(weth.address, loan)
  
    await weth.mint(borrower.address, 1, { from: user1 })
    await borrower.flashBorrow(lender.address, weth.address, loan, { from: user1 })

    const balanceAfter = await lender.balanceOf(user1)
    balanceAfter.toString().should.equal('0')
    const flashBalance = await borrower.flashBalance()
    flashBalance.toString().should.equal(loan.add(fee).toString())
    const flashToken = await borrower.flashToken()
    flashToken.toString().should.equal(weth.address)
    const flashAmount = await borrower.flashAmount()
    flashAmount.toString().should.equal(loan.toString())
    const flashFee = await borrower.flashFee()
    flashFee.toString().should.equal(fee.toString())
    const flashSender = await borrower.flashSender()
    flashSender.toString().should.equal(borrower.address)
  })


  it('lenders can choose to charge no fees', async () => {
    lender = await FlashMinter.new("Test", "TST", MAX)
    weth = lender

    await borrower.flashBorrow(lender.address, weth.address, 1000, { from: user1 })

    const balanceAfter = await lender.balanceOf(user1)
    balanceAfter.toString().should.equal(new BN('0').toString())
    const flashBalance = await borrower.flashBalance()
    flashBalance.toString().should.equal(new BN('1000').toString())
    const flashToken = await borrower.flashToken()
    flashToken.toString().should.equal(weth.address)
    const flashAmount = await borrower.flashAmount()
    flashAmount.toString().should.equal(new BN('1000').toString())
    const flashFee = await borrower.flashFee()
    flashFee.toString().should.equal(new BN('0').toString())
    const flashSender = await borrower.flashSender()
    flashSender.toString().should.equal(borrower.address)
  })

  it('can not flash loan from an EOA', async () => {
    await expectRevert(
      lender.flashLoan(borrower.address, weth.address, 1, '0x0000000000000000000000000000000000000000000000000000000000000000', { from: user1 }),
      'FlashBorrower: External loan initiator'
    )
  })

  it('needs to return funds after a flash loan', async () => {
    await expectRevert(
      borrower.flashBorrowAndSteal(lender.address, weth.address, 1),
      'FlashMinter: Flash loan repayment not approved'
    )
  })

  it('should do two nested flash loans', async () => {
    await borrower.flashBorrowAndReenter(lender.address, weth.address, 1)

    const flashBalance = await borrower.flashBalance()
    flashBalance.toString().should.equal('3')
  })
})