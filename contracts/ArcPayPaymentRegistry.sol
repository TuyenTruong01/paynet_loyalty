// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ArcPayPaymentRegistry {
    address public owner;

    struct PaymentProof {
        bytes32 invoiceHash;
        uint256 amount;
        address payer;
        address merchant;
        bytes32 paymentTxHash;
        bytes32 checkoutTokenHash;
        uint256 recordedAt;
        address recorder;
        string metadataURI;
        bool exists;
    }

    mapping(bytes32 => PaymentProof) private proofs;

    event PaymentProofRecorded(
        bytes32 indexed invoiceHash,
        address indexed payer,
        address indexed merchant,
        uint256 amount,
        bytes32 paymentTxHash,
        bytes32 checkoutTokenHash,
        address recorder,
        string metadataURI
    );

    event OwnerChanged(address indexed oldOwner, address indexed newOwner);

    error ProofAlreadyExists();
    error ProofNotFound();
    error InvalidInvoiceHash();
    error InvalidAmount();
    error InvalidAddress();
    error NotPayerOrMerchant();
    error OnlyOwner();

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();

        address oldOwner = owner;
        owner = newOwner;

        emit OwnerChanged(oldOwner, newOwner);
    }

    function recordPaymentProof(
        bytes32 invoiceHash,
        uint256 amount,
        address payer,
        address merchant,
        bytes32 paymentTxHash,
        bytes32 checkoutTokenHash,
        string calldata metadataURI
    ) external {
        if (invoiceHash == bytes32(0)) revert InvalidInvoiceHash();
        if (amount == 0) revert InvalidAmount();
        if (payer == address(0) || merchant == address(0)) revert InvalidAddress();
        if (proofs[invoiceHash].exists) revert ProofAlreadyExists();

        // Người ghi proof phải là payer hoặc merchant.
        // Với app hiện tại: khách hoặc ví cửa hàng đều có thể ghi proof sau khi payment success.
        if (msg.sender != payer && msg.sender != merchant) revert NotPayerOrMerchant();

        proofs[invoiceHash] = PaymentProof({
            invoiceHash: invoiceHash,
            amount: amount,
            payer: payer,
            merchant: merchant,
            paymentTxHash: paymentTxHash,
            checkoutTokenHash: checkoutTokenHash,
            recordedAt: block.timestamp,
            recorder: msg.sender,
            metadataURI: metadataURI,
            exists: true
        });

        emit PaymentProofRecorded(
            invoiceHash,
            payer,
            merchant,
            amount,
            paymentTxHash,
            checkoutTokenHash,
            msg.sender,
            metadataURI
        );
    }

    function getPaymentProof(bytes32 invoiceHash)
        external
        view
        returns (
            bytes32,
            uint256,
            address,
            address,
            bytes32,
            bytes32,
            uint256,
            address,
            string memory
        )
    {
        PaymentProof memory proof = proofs[invoiceHash];

        if (!proof.exists) revert ProofNotFound();

        return (
            proof.invoiceHash,
            proof.amount,
            proof.payer,
            proof.merchant,
            proof.paymentTxHash,
            proof.checkoutTokenHash,
            proof.recordedAt,
            proof.recorder,
            proof.metadataURI
        );
    }

    function hasPaymentProof(bytes32 invoiceHash) external view returns (bool) {
        return proofs[invoiceHash].exists;
    }
}