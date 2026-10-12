<?php
/**
 * BillingController
 * Production POS Billing Engine, Multi-Line Cart, Integer-Paise Balance Guard,
 * Inventory Synchronization, Customer Dues Integration & SV Packages
 */
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../audit.php';
require_once __DIR__ . '/../auth.php';

class BillingController {
    public static function handle(string $action, array $payload, ?array $user): array {
        if (!$user || !Auth::checkPermission($user, 'billing', 'read')) {
            return ['ok' => false, 'error' => ['code' => 'FORBIDDEN', 'message' => 'Permission denied.']];
        }

        $db = Database::getConnection();

        switch ($action) {
            case 'listEntries':
            case 'listBills':
                $date = $payload['date'] ?? null;
                $startDate = $payload['startDate'] ?? null;
                $endDate = $payload['endDate'] ?? null;
                $search = trim($payload['search'] ?? '');
                $status = $payload['status'] ?? 'all';
                $billType = $payload['billType'] ?? 'all';

                $bills = [];

                if ($billType !== 'tv_out') {
                    $sql = "SELECT b.*, c.CustomerCode, c.Mobile as CustomerPhone 
                            FROM bills b 
                            LEFT JOIN customers c ON b.CustomerID = c.CustomerID 
                            WHERE b.IsDeleted = 0";
                    $params = [];

                    if (!empty($date)) {
                        $sql .= " AND b.BillDate = ?";
                        $params[] = $date;
                    } elseif (!empty($startDate) && !empty($endDate)) {
                        $sql .= " AND b.BillDate BETWEEN ? AND ?";
                        $params[] = $startDate;
                        $params[] = $endDate;
                    }

                    if ($status === 'active') {
                        $sql .= " AND b.IsCancelled = 0";
                    } elseif ($status === 'cancelled') {
                        $sql .= " AND b.IsCancelled = 1";
                    }

                    if (!empty($search)) {
                        $sql .= " AND (b.BillNumber LIKE ? OR b.CustomerName LIKE ? OR b.CustomerMobile LIKE ? OR b.ConsumerNo LIKE ?)";
                        $term = "%$search%";
                        $params[] = $term;
                        $params[] = $term;
                        $params[] = $term;
                        $params[] = $term;
                    }

                    $sql .= " ORDER BY b.BillID DESC LIMIT " . MAX_PAGE_SIZE;
                    $stmt = $db->prepare($sql);
                    $stmt->execute($params);
                    $bills = $stmt->fetchAll();
                }

                // If TV Out should be included
                if ($billType === 'all' || $billType === 'tv_out') {
                    $tvSql = "SELECT sr.*, c.CustomerCode, c.Mobile as CustomerPhone
                              FROM security_refunds sr
                              LEFT JOIN customers c ON sr.CustomerID = c.CustomerID
                              WHERE 1=1";
                    $tvParams = [];

                    if (!empty($date)) {
                        $tvSql .= " AND sr.Date = ?";
                        $tvParams[] = $date;
                    } elseif (!empty($startDate) && !empty($endDate)) {
                        $tvSql .= " AND sr.Date BETWEEN ? AND ?";
                        $tvParams[] = $startDate;
                        $tvParams[] = $endDate;
                    }

                    if (!empty($search)) {
                        $tvSql .= " AND (sr.RefundNumber LIKE ? OR sr.CustomerName LIKE ? OR sr.CustomerMobile LIKE ? OR sr.ConsumerNo LIKE ?)";
                        $term = "%$search%";
                        $tvParams[] = $term;
                        $tvParams[] = $term;
                        $tvParams[] = $term;
                        $tvParams[] = $term;
                    }

                    $tvSql .= " ORDER BY sr.RefundID DESC LIMIT " . MAX_PAGE_SIZE;
                    $tvStmt = $db->prepare($tvSql);
                    $tvStmt->execute($tvParams);
                    $tvRows = $tvStmt->fetchAll();

                    foreach ($tvRows as $r) {
                        $payMode = strtoupper($r['PaymentMode'] ?? 'CASH');
                        $bills[] = [
                            'BillID' => (int)$r['RefundID'],
                            'BillNumber' => $r['RefundNumber'],
                            'BillDate' => $r['Date'],
                            'CustomerID' => (int)($r['CustomerID'] ?? 0),
                            'CustomerCode' => $r['CustomerCode'] ?? '',
                            'CustomerName' => $r['CustomerName'],
                            'CustomerMobile' => $r['CustomerMobile'] ?? '',
                            'ConsumerNo' => $r['ConsumerNo'] ?? '',
                            'CustomerType' => $r['CustomerType'] ?? 'DOMESTIC',
                            'Subtotal' => (float)$r['SecurityAmount'],
                            'TaxAmount' => 0.0,
                            'DiscountAmount' => (float)$r['DeductionAmount'],
                            'TotalAmount' => (float)$r['RefundAmount'],
                            'TotalPaise' => (int)$r['RefundAmountPaise'],
                            'SettlementPaise' => (int)$r['RefundAmountPaise'],
                            'PaidCash' => ($payMode === 'CASH') ? (float)$r['RefundAmount'] : 0.0,
                            'PaidUPI' => ($payMode === 'UPI') ? (float)$r['RefundAmount'] : 0.0,
                            'PaidHPPay' => 0.0,
                            'PaidDues' => 0.0,
                            'PaidBank' => ($payMode === 'BANK') ? (float)$r['RefundAmount'] : 0.0,
                            'Status' => $r['Status'] ?? 'COMPLETED',
                            'IsCancelled' => 0,
                            'BillType' => 'TV_OUT',
                            'RefundID' => (int)$r['RefundID'],
                            'CylinderType' => $r['CylinderType'] ?? '14.2 KG Domestic',
                            'CylindersReturned' => (int)($r['CylindersReturned'] ?? 1),
                            'RegulatorReturned' => (int)($r['RegulatorReturned'] ?? 1),
                            'PassbookReturned' => (int)($r['PassbookReturned'] ?? 1),
                            'TvOutCharge' => (float)($r['TvOutCharge'] ?? 0),
                            'AdminCharge' => (float)($r['AdminCharge'] ?? 0),
                            'ImprestFund' => (float)($r['ImprestFund'] ?? 0),
                            'SecurityAmount' => (float)$r['SecurityAmount'],
                            'DeductionAmount' => (float)$r['DeductionAmount'],
                            'RefundAmount' => (float)$r['RefundAmount']
                        ];
                    }
                }

                // Sort by Date DESC, ID DESC
                usort($bills, function($a, $b) {
                    $da = $a['BillDate'] ?? '';
                    $db = $b['BillDate'] ?? '';
                    if ($da !== $db) return strcmp($db, $da);
                    return ($b['BillID'] ?? 0) <=> ($a['BillID'] ?? 0);
                });

                return ['ok' => true, 'data' => $bills];

            case 'getTvOutBill':
                $refId = (int)($payload['RefundID'] ?? 0);
                $refNo = trim($payload['RefundNumber'] ?? '');
                if ($refId > 0) {
                    $stmt = $db->prepare("SELECT * FROM security_refunds WHERE RefundID = ?");
                    $stmt->execute([$refId]);
                } else {
                    $stmt = $db->prepare("SELECT * FROM security_refunds WHERE RefundNumber = ?");
                    $stmt->execute([$refNo]);
                }
                $record = $stmt->fetch();
                if (!$record) {
                    return ['ok' => false, 'error' => ['code' => 'NOT_FOUND', 'message' => 'TV Out bill not found.']];
                }
                return ['ok' => true, 'data' => $record];

            case 'getBill':
                $billId = (int)($payload['BillID'] ?? 0);
                $billNo = trim($payload['BillNumber'] ?? '');

                if ($billId > 0) {
                    $stmt = $db->prepare("SELECT * FROM bills WHERE BillID = ?");
                    $stmt->execute([$billId]);
                } else {
                    $stmt = $db->prepare("SELECT * FROM bills WHERE BillNumber = ?");
                    $stmt->execute([$billNo]);
                }
                $bill = $stmt->fetch();

                if (!$bill) {
                    // Check if it's a TV Out Refund
                    if ($billId > 0) {
                        $tvStmt = $db->prepare("SELECT * FROM security_refunds WHERE RefundID = ?");
                        $tvStmt->execute([$billId]);
                    } else {
                        $tvStmt = $db->prepare("SELECT * FROM security_refunds WHERE RefundNumber = ?");
                        $tvStmt->execute([$billNo]);
                    }
                    $tvRow = $tvStmt->fetch();
                    if ($tvRow) {
                        $tvRow['BillType'] = 'TV_OUT';
                        return ['ok' => true, 'data' => $tvRow];
                    }
                    return ['ok' => false, 'error' => ['code' => 'NOT_FOUND', 'message' => 'Bill not found.']];
                }

                // Get items
                $itemStmt = $db->prepare("SELECT * FROM bill_items WHERE BillID = ?");
                $itemStmt->execute([$bill['BillID']]);
                $bill['items'] = $itemStmt->fetchAll();

                // Get payments
                $payStmt = $db->prepare("SELECT * FROM bill_payments WHERE BillID = ?");
                $payStmt->execute([$bill['BillID']]);
                $bill['payments'] = $payStmt->fetchAll();

                // Get customer if exists
                if ($bill['CustomerID']) {
                    $custStmt = $db->prepare("SELECT * FROM customers WHERE CustomerID = ?");
                    $custStmt->execute([$bill['CustomerID']]);
                    $bill['customer'] = $custStmt->fetch();
                }

                return ['ok' => true, 'data' => $bill];

            case 'addEntry':
            case 'addBill':
                if (!Auth::checkPermission($user, 'billing', 'create')) {
                    return ['ok' => false, 'error' => ['code' => 'FORBIDDEN', 'message' => 'Permission to create bills denied.']];
                }

                $billDate = $payload['BillDate'] ?? date('Y-m-d');

                // Check if Day is already closed
                $closeCheck = $db->prepare("SELECT IsClosed FROM cashbook WHERE Date = ?");
                $closeCheck->execute([$billDate]);
                if ((int)$closeCheck->fetchColumn() === 1) {
                    return ['ok' => false, 'error' => ['code' => 'DAY_CLOSED', 'message' => 'Unable to save bill because the business day is already closed. Contact Admin to unlock.']];
                }

                $items = $payload['items'] ?? ($payload['Items'] ?? []);
                if (empty($items) || !is_array($items)) {
                    return ['ok' => false, 'error' => ['code' => 'VALIDATION', 'message' => 'Cart cannot be empty. Please add at least one item.']];
                }

                $customerId = !empty($payload['CustomerID']) ? (int)$payload['CustomerID'] : null;
                $customerName = trim($payload['CustomerName'] ?? 'Counter Walk-in');
                $customerMobile = trim($payload['CustomerMobile'] ?? '');
                $consumerNo = trim($payload['ConsumerNo'] ?? '');
                $customerType = trim($payload['CustomerType'] ?? ($payload['CustType'] ?? 'DOMESTIC'));

                // Calculate Cart in Integer Paise
                $calculatedSubtotalPaise = 0;
                $calculatedDiscountPaise = (int)round(((float)($payload['DiscountAmount'] ?? 0)) * 100);
                $calculatedTaxPaise = 0;

                $validatedItems = [];
                foreach ($items as $idx => $it) {
                    $qty = (int)($it['Quantity'] ?? 1);
                    if ($qty <= 0) {
                        return ['ok' => false, 'error' => ['code' => 'VALIDATION', 'message' => "Item at row " . ($idx + 1) . " has invalid quantity."]];
                    }
                    $rate = (float)($it['Rate'] ?? 0);
                    if ($rate < 0) {
                        return ['ok' => false, 'error' => ['code' => 'VALIDATION', 'message' => "Negative rate is not permitted."]];
                    }
                    $ratePaise = (int)round($rate * 100);
                    $lineTotalPaise = $ratePaise * $qty;
                    $taxPct = (float)($it['TaxPercent'] ?? 0);
                    $lineTaxPaise = (int)round(($lineTotalPaise * $taxPct) / 100);

                    $calculatedSubtotalPaise += $lineTotalPaise;
                    $calculatedTaxPaise += $lineTaxPaise;

                    $validatedItems[] = [
                        'ItemID' => (int)($it['ItemID'] ?? 0),
                        'ItemName' => trim($it['ItemName'] ?? 'Item'),
                        'Category' => trim($it['Category'] ?? 'SALE'),
                        'CylinderType' => !empty($it['CylinderType']) ? trim($it['CylinderType']) : null,
                        'Quantity' => $qty,
                        'Rate' => $rate,
                        'RatePaise' => $ratePaise,
                        'Discount' => 0.0,
                        'TaxPercent' => $taxPct,
                        'Total' => ($lineTotalPaise + $lineTaxPaise) / 100,
                        'TotalPaise' => $lineTotalPaise + $lineTaxPaise
                    ];
                }

                $totalBillPaise = $calculatedSubtotalPaise + $calculatedTaxPaise - $calculatedDiscountPaise;
                if ($totalBillPaise < 0) $totalBillPaise = 0;

                // Validate Payments & Integer Paise Balance Guard
                $paidCash = (float)($payload['PaidCash'] ?? 0);
                $paidUPI = (float)($payload['PaidUPI'] ?? 0);
                $paidHPPay = (float)($payload['PaidHPPay'] ?? 0);
                $paidDues = (float)($payload['PaidDues'] ?? 0);
                $paidBank = (float)($payload['PaidBank'] ?? 0);

                if ($paidCash < 0 || $paidUPI < 0 || $paidHPPay < 0 || $paidDues < 0 || $paidBank < 0) {
                    return ['ok' => false, 'error' => ['code' => 'VALIDATION', 'message' => 'Payment amounts cannot be negative.']];
                }

                $cashPaise = (int)round($paidCash * 100);
                $upiPaise = (int)round($paidUPI * 100);
                $hpPayPaise = (int)round($paidHPPay * 100);
                $duesPaise = (int)round($paidDues * 100);
                $bankPaise = (int)round($paidBank * 100);

                $totalSettlementPaise = $cashPaise + $upiPaise + $hpPayPaise + $duesPaise + $bankPaise;

                // CRITICAL BALANCE GUARD: Total Bill Paise === Total Settlement Paise
                if ($totalBillPaise !== $totalSettlementPaise) {
                    $diff = abs($totalBillPaise - $totalSettlementPaise) / 100;
                    return ['ok' => false, 'error' => [
                        'code' => 'VALIDATION',
                        'message' => "Settlement mismatch! Bill Total is ₹" . number_format($totalBillPaise / 100, 2) .
                                     " but total payment settlement entered is ₹" . number_format($totalSettlementPaise / 100, 2) .
                                     " (Difference: ₹" . number_format($diff, 2) . ")."
                    ]];
                }

                // If dues settlement used, customer must be provided
                if ($duesPaise > 0 && !$customerId) {
                    return ['ok' => false, 'error' => ['code' => 'VALIDATION', 'message' => 'Customer selection is mandatory for dues credit balance.']];
                }

                // ATOMIC WRITE TRANSACTION
                $db->beginTransaction();
                try {
                    // Generate Unique Bill Number: INV-YYYYMMDD-XXXX
                    $datePrefix = date('Ymd', strtotime($billDate));
                    $seqStmt = $db->prepare("SELECT COUNT(*) FROM bills WHERE BillNumber LIKE ?");
                    $seqStmt->execute(["INV-$datePrefix%"]);
                    $seq = (int)$seqStmt->fetchColumn() + 1;
                    $billNumber = sprintf("INV-%s-%04d", $datePrefix, $seq);

                    $now = date('Y-m-d H:i:s');
                    $subtotal = $calculatedSubtotalPaise / 100;
                    $taxAmount = $calculatedTaxPaise / 100;
                    $discountAmount = $calculatedDiscountPaise / 100;
                    $totalAmount = $totalBillPaise / 100;

                    $notes = trim($payload['Notes'] ?? '');
                    if (!empty($payload['HawkerName'])) {
                        $hawkerTag = "Hawker: " . trim($payload['HawkerName']);
                        $notes = !empty($notes) ? ($notes . " | " . $hawkerTag) : $hawkerTag;
                    }

                    // Insert Bill
                    $insBill = $db->prepare("INSERT INTO bills (
                        BillNumber, BillDate, CustomerID, CustomerName, CustomerMobile, ConsumerNo, CustomerType,
                        Subtotal, TaxAmount, DiscountAmount, TotalAmount, TotalPaise, SettlementPaise,
                        PaidCash, PaidUPI, PaidHPPay, PaidDues, PaidBank, Status, BillType, Notes,
                        CreatedBy, CreatedByName, CreatedAt, UpdatedAt
                    ) VALUES (
                        ?, ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?, 'FINAL', 'SALE', ?,
                        ?, ?, ?, ?
                    )");
                    $insBill->execute([
                        $billNumber, $billDate, $customerId, $customerName, $customerMobile, $consumerNo, $customerType,
                        $subtotal, $taxAmount, $discountAmount, $totalAmount, $totalBillPaise, $totalSettlementPaise,
                        $paidCash, $paidUPI, $paidHPPay, $paidDues, $paidBank, $notes,
                        $user['userId'], $user['fullName'], $now, $now
                    ]);
                    $billId = (int)$db->lastInsertId();

                    // Insert Bill Items
                    $insItem = $db->prepare("INSERT INTO bill_items (
                        BillID, ItemID, ItemName, Category, CylinderType, Quantity, Rate, RatePaise, Discount, TaxPercent, Total, TotalPaise
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

                    foreach ($validatedItems as $vi) {
                        $insItem->execute([
                            $billId, $vi['ItemID'], $vi['ItemName'], $vi['Category'], $vi['CylinderType'],
                            $vi['Quantity'], $vi['Rate'], $vi['RatePaise'], $vi['Discount'], $vi['TaxPercent'],
                            $vi['Total'], $vi['TotalPaise']
                        ]);

                        // Record Stock Movements for cylinders
                        if (!empty($vi['CylinderType']) && $vi['Category'] === 'SALE') {
                            $mov = $db->prepare("INSERT INTO stock_movements (Date, CylinderType, MovementType, Quantity, FullOrEmpty, ReferenceNo, Reason, CreatedBy, CreatedAt)
                                VALUES (?, ?, 'COUNTER_SALE', ?, 'FULL_OUT', ?, 'POS Bill Sale', ?, ?)");
                            $mov->execute([$billDate, $vi['CylinderType'], $vi['Quantity'], $billNumber, $user['userId'], $now]);
                        }
                    }

                    // Insert Bill Payments
                    $insPay = $db->prepare("INSERT INTO bill_payments (BillID, PaymentMode, Amount, AmountPaise, ReferenceNo, PaymentDate, CreatedBy, CreatedAt)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
                    if ($cashPaise > 0) $insPay->execute([$billId, 'CASH', $paidCash, $cashPaise, $billNumber, $billDate, $user['userId'], $now]);
                    if ($upiPaise > 0) $insPay->execute([$billId, 'UPI', $paidUPI, $upiPaise, $payload['UPIReference'] ?? $billNumber, $billDate, $user['userId'], $now]);
                    if ($hpPayPaise > 0) $insPay->execute([$billId, 'HP_PAY', $paidHPPay, $hpPayPaise, $payload['HPPayReference'] ?? $billNumber, $billDate, $user['userId'], $now]);
                    if ($duesPaise > 0) $insPay->execute([$billId, 'DUES', $paidDues, $duesPaise, $billNumber, $billDate, $user['userId'], $now]);
                    if ($bankPaise > 0) $insPay->execute([$billId, 'BANK', $paidBank, $bankPaise, $payload['BankReference'] ?? $billNumber, $billDate, $user['userId'], $now]);

                    // If Dues > 0, Create Customer Due Record
                    if ($duesPaise > 0 && $customerId) {
                        $dueNumber = sprintf("DUE-%s-%04d", $datePrefix, $seq);
                        $insDue = $db->prepare("INSERT INTO customer_dues (
                            DueNumber, CustomerID, BillID, DueDate, OriginalAmount, OriginalPaise,
                            RemainingAmount, RemainingPaise, Status, CreatedBy, CreatedAt, UpdatedAt
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)");
                        $insDue->execute([$dueNumber, $customerId, $billId, $billDate, $paidDues, $duesPaise, $paidDues, $duesPaise, $user['userId'], $now, $now]);

                        // Update Customer Current Dues
                        $updCust = $db->prepare("UPDATE customers SET 
                            CurrentDues = CurrentDues + ?, 
                            CurrentDuesPaise = CurrentDuesPaise + ?,
                            TotalRefills = TotalRefills + 1,
                            LifetimeValue = LifetimeValue + ?,
                            LastRefillDate = ?,
                            UpdatedAt = ?
                            WHERE CustomerID = ?");
                        $updCust->execute([$paidDues, $duesPaise, $totalAmount, $billDate, $now, $customerId]);
                    } elseif ($customerId) {
                        // Update Customer Lifetime stats
                        $updCust = $db->prepare("UPDATE customers SET 
                            TotalRefills = TotalRefills + 1,
                            LifetimeValue = LifetimeValue + ?,
                            LastRefillDate = ?,
                            UpdatedAt = ?
                            WHERE CustomerID = ?");
                        $updCust->execute([$totalAmount, $billDate, $now, $customerId]);
                    }

                    // Auto-sync Cashbook counter cash for the date
                    $cashbookCheck = $db->prepare("SELECT CashbookID FROM cashbook WHERE Date = ?");
                    $cashbookCheck->execute([$billDate]);
                    $cbId = $cashbookCheck->fetchColumn();
                    if ($cbId) {
                        $updCb = $db->prepare("UPDATE cashbook SET 
                            CounterCash = CounterCash + ?,
                            TotalInflow = TotalInflow + ?,
                            ExpectedClosing = ExpectedClosing + ?,
                            UpdatedAt = ?
                            WHERE CashbookID = ?");
                        $updCb->execute([$paidCash, $paidCash, $paidCash, $now, $cbId]);
                    } else {
                        // Initialize cashbook for the date with this cash
                        $insCb = $db->prepare("INSERT INTO cashbook (Date, OpeningCash, CounterCash, TotalInflow, ExpectedClosing, PhysicalClosing, CreatedBy, CreatedAt, UpdatedAt)
                            VALUES (?, 0, ?, ?, ?, 0, ?, ?, ?)");
                        $insCb->execute([$billDate, $paidCash, $paidCash, $paidCash, $user['userId'], $now, $now]);
                    }

                    $db->commit();

                    Audit::log($user['userId'], $user['username'], 'CREATE', 'billing', (string)$billId, null, [
                        'billNumber' => $billNumber,
                        'totalAmount' => $totalAmount,
                        'customer' => $customerName
                    ], 'POS Bill Generated');

                    return [
                        'ok' => true,
                        'data' => [
                            'BillID' => $billId,
                            'BillNumber' => $billNumber,
                            'TotalAmount' => $totalAmount,
                            'BillDate' => $billDate
                        ],
                        'message' => "Bill $billNumber saved successfully."
                    ];
                } catch (Exception $e) {
                    $db->rollBack();
                    return ['ok' => false, 'error' => ['code' => 'SERVER', 'message' => 'Failed to save bill: ' . $e->getMessage()]];
                }

            case 'cancelBill':
                if (!Auth::checkPermission($user, 'billing', 'delete') && $user['role'] !== 'ADMIN') {
                    return ['ok' => false, 'error' => ['code' => 'FORBIDDEN', 'message' => 'Authorization to cancel bills required.']];
                }

                $billId = (int)($payload['BillID'] ?? 0);
                $reason = trim($payload['Reason'] ?? '');
                if (empty($reason)) {
                    return ['ok' => false, 'error' => ['code' => 'VALIDATION', 'message' => 'Mandatory cancellation reason required.']];
                }

                $stmt = $db->prepare("SELECT * FROM bills WHERE BillID = ?");
                $stmt->execute([$billId]);
                $bill = $stmt->fetch();

                if (!$bill) {
                    return ['ok' => false, 'error' => ['code' => 'NOT_FOUND', 'message' => 'Bill not found.']];
                }

                if ((int)$bill['IsCancelled'] === 1) {
                    return ['ok' => false, 'error' => ['code' => 'CONFLICT', 'message' => 'Bill is already cancelled.']];
                }

                // Check if Day is closed
                $cbCheck = $db->prepare("SELECT IsClosed FROM cashbook WHERE Date = ?");
                $cbCheck->execute([$bill['BillDate']]);
                if ((int)$cbCheck->fetchColumn() === 1 && $user['role'] !== 'ADMIN') {
                    return ['ok' => false, 'error' => ['code' => 'DAY_CLOSED', 'message' => 'Day is closed. Only Admin can cancel bills for closed dates.']];
                }

                $db->beginTransaction();
                try {
                    $now = date('Y-m-d H:i:s');

                    // Mark Bill Cancelled
                    $upd = $db->prepare("UPDATE bills SET IsCancelled = 1, CancelReason = ?, CancelledBy = ?, CancelledAt = ?, UpdatedAt = ? WHERE BillID = ?");
                    $upd->execute([$reason, $user['userId'], $now, $now, $billId]);

                    // Reversal 1: Reverse Stock Movements
                    $revMov = $db->prepare("INSERT INTO stock_movements (Date, CylinderType, MovementType, Quantity, FullOrEmpty, ReferenceNo, Reason, CreatedBy, CreatedAt)
                        SELECT ?, CylinderType, 'SALE_REVERSAL', Quantity, 'FULL_IN', ?, 'Bill Cancelled Reversal', ?, ?
                        FROM bill_items WHERE BillID = ? AND Category = 'SALE' AND CylinderType IS NOT NULL");
                    $revMov->execute([date('Y-m-d'), $bill['BillNumber'], $user['userId'], $now, $billId]);

                    // Reversal 2: Reverse Customer Dues if applicable
                    if ((float)$bill['PaidDues'] > 0 && $bill['CustomerID']) {
                        $updDue = $db->prepare("UPDATE customer_dues SET Status = 'CANCELLED', WriteOffReason = 'Bill Cancelled', UpdatedAt = ? WHERE BillID = ?");
                        $updDue->execute([$now, $billId]);

                        $duesPaise = (int)round(((float)$bill['PaidDues']) * 100);
                        $updCust = $db->prepare("UPDATE customers SET 
                            CurrentDues = MAX(0, CurrentDues - ?), 
                            CurrentDuesPaise = MAX(0, CurrentDuesPaise - ?),
                            LifetimeValue = MAX(0, LifetimeValue - ?),
                            UpdatedAt = ?
                            WHERE CustomerID = ?");
                        $updCust->execute([(float)$bill['PaidDues'], $duesPaise, (float)$bill['TotalAmount'], $now, $bill['CustomerID']]);
                    }

                    // Reversal 3: Reverse Cashbook Counter Cash
                    if ((float)$bill['PaidCash'] > 0) {
                        $revCb = $db->prepare("UPDATE cashbook SET 
                            CounterCash = MAX(0, CounterCash - ?),
                            TotalInflow = MAX(0, TotalInflow - ?),
                            ExpectedClosing = MAX(0, ExpectedClosing - ?),
                            UpdatedAt = ?
                            WHERE Date = ?");
                        $revCb->execute([(float)$bill['PaidCash'], (float)$bill['PaidCash'], (float)$bill['PaidCash'], $now, $bill['BillDate']]);
                    }

                    $db->commit();

                    Audit::log($user['userId'], $user['username'], 'BILL_CANCEL', 'billing', (string)$billId, $bill, ['reason' => $reason], "Bill {$bill['BillNumber']} cancelled");

                    return ['ok' => true, 'data' => null, 'message' => "Bill {$bill['BillNumber']} cancelled and all inventory & ledger effects reversed."];
                } catch (Exception $e) {
                    $db->rollBack();
                    return ['ok' => false, 'error' => ['code' => 'SERVER', 'message' => 'Failed to cancel bill: ' . $e->getMessage()]];
                }

            case 'deleteBill':
                if ($user['role'] !== 'ADMIN' && !Auth::checkPermission($user, 'billing', 'delete')) {
                    return ['ok' => false, 'error' => ['code' => 'FORBIDDEN', 'message' => 'Only Admin can permanently delete bills.']];
                }

                $billId = (int)($payload['BillID'] ?? 0);
                $billType = $payload['BillType'] ?? 'SALE';
                $reason = trim($payload['Reason'] ?? 'Deleted by Admin');

                if ($billType === 'TV_OUT') {
                    $stmt = $db->prepare("SELECT * FROM security_refunds WHERE RefundID = ?");
                    $stmt->execute([$billId]);
                    $ref = $stmt->fetch();
                    if (!$ref) {
                        return ['ok' => false, 'error' => ['code' => 'NOT_FOUND', 'message' => 'TV Out voucher not found.']];
                    }

                    $db->beginTransaction();
                    try {
                        $now = date('Y-m-d H:i:s');
                        // Reversal 1: Reverse cylinder stock movement if returned empty cylinder was added
                        if ((int)$ref['CylindersReturned'] > 0) {
                            $revMov = $db->prepare("INSERT INTO stock_movements (Date, CylinderType, MovementType, Quantity, FullOrEmpty, ReferenceNo, Reason, CreatedBy, CreatedAt)
                                VALUES (?, ?, 'STOCK_ADJUSTMENT', ?, 'EMPTY', ?, 'TV Out Deleted Reversal', ?, ?)");
                            $revMov->execute([date('Y-m-d'), $ref['CylinderType'], -(int)$ref['CylindersReturned'], $ref['RefundNumber'], $user['userId'], $now]);
                        }

                        // Reversal 2: Reverse Cashbook outflow if paid cash
                        if ($ref['PaymentMode'] === 'CASH' && (float)$ref['RefundAmount'] > 0) {
                            $revCb = $db->prepare("UPDATE cashbook SET 
                                Refunds = MAX(0, Refunds - ?),
                                TotalOutflow = MAX(0, TotalOutflow - ?),
                                ExpectedClosing = ExpectedClosing + ?,
                                UpdatedAt = ?
                                WHERE Date = ?");
                            $revCb->execute([(float)$ref['RefundAmount'], (float)$ref['RefundAmount'], (float)$ref['RefundAmount'], $now, $ref['Date']]);
                        }

                        // Permanently remove from security_refunds
                        $del = $db->prepare("DELETE FROM security_refunds WHERE RefundID = ?");
                        $del->execute([$billId]);

                        $db->commit();
                        Audit::log($user['userId'], $user['username'], 'BILL_DELETE', 'billing', (string)$billId, $ref, ['reason' => $reason], "TV Out Voucher {$ref['RefundNumber']} deleted by Admin");
                        return ['ok' => true, 'message' => "TV Out Voucher {$ref['RefundNumber']} deleted successfully."];
                    } catch (Exception $e) {
                        $db->rollBack();
                        return ['ok' => false, 'error' => ['code' => 'SERVER', 'message' => 'Failed to delete TV Out voucher: ' . $e->getMessage()]];
                    }
                }

                // Regular Bill deletion
                $stmt = $db->prepare("SELECT * FROM bills WHERE BillID = ?");
                $stmt->execute([$billId]);
                $bill = $stmt->fetch();
                if (!$bill) {
                    return ['ok' => false, 'error' => ['code' => 'NOT_FOUND', 'message' => 'Bill not found.']];
                }

                $db->beginTransaction();
                try {
                    $now = date('Y-m-d H:i:s');

                    // If not already cancelled, reverse stock, dues, and cashbook
                    if ((int)$bill['IsCancelled'] === 0) {
                        // Reverse Stock
                        $revMov = $db->prepare("INSERT INTO stock_movements (Date, CylinderType, MovementType, Quantity, FullOrEmpty, ReferenceNo, Reason, CreatedBy, CreatedAt)
                            SELECT ?, CylinderType, 'SALE_REVERSAL', Quantity, 'FULL_IN', ?, 'Bill Deleted Reversal', ?, ?
                            FROM bill_items WHERE BillID = ? AND Category = 'SALE' AND CylinderType IS NOT NULL");
                        $revMov->execute([date('Y-m-d'), $bill['BillNumber'], $user['userId'], $now, $billId]);

                        // Reverse Customer Dues
                        if ((float)$bill['PaidDues'] > 0 && $bill['CustomerID']) {
                            $updDue = $db->prepare("UPDATE customer_dues SET Status = 'CANCELLED', WriteOffReason = 'Bill Deleted', UpdatedAt = ? WHERE BillID = ?");
                            $updDue->execute([$now, $billId]);

                            $duesPaise = (int)round(((float)$bill['PaidDues']) * 100);
                            $updCust = $db->prepare("UPDATE customers SET 
                                CurrentDues = MAX(0, CurrentDues - ?), 
                                CurrentDuesPaise = MAX(0, CurrentDuesPaise - ?),
                                LifetimeValue = MAX(0, LifetimeValue - ?),
                                UpdatedAt = ?
                                WHERE CustomerID = ?");
                            $updCust->execute([(float)$bill['PaidDues'], $duesPaise, (float)$bill['TotalAmount'], $now, $bill['CustomerID']]);
                        }

                        // Reverse Cashbook
                        if ((float)$bill['PaidCash'] > 0) {
                            $revCb = $db->prepare("UPDATE cashbook SET 
                                CounterCash = MAX(0, CounterCash - ?),
                                TotalInflow = MAX(0, TotalInflow - ?),
                                ExpectedClosing = MAX(0, ExpectedClosing - ?),
                                UpdatedAt = ?
                                WHERE Date = ?");
                            $revCb->execute([(float)$bill['PaidCash'], (float)$bill['PaidCash'], (float)$bill['PaidCash'], $now, $bill['BillDate']]);
                        }
                    }

                    // Soft Delete: Mark IsDeleted = 1
                    $updDel = $db->prepare("UPDATE bills SET IsDeleted = 1, UpdatedAt = ? WHERE BillID = ?");
                    $updDel->execute([$now, $billId]);

                    $db->commit();
                    Audit::log($user['userId'], $user['username'], 'BILL_DELETE', 'billing', (string)$billId, $bill, ['reason' => $reason], "Bill {$bill['BillNumber']} deleted by Admin");
                    return ['ok' => true, 'message' => "Bill {$bill['BillNumber']} deleted successfully."];
                } catch (Exception $e) {
                    $db->rollBack();
                    return ['ok' => false, 'error' => ['code' => 'SERVER', 'message' => 'Failed to delete bill: ' . $e->getMessage()]];
                }

            case 'issueNewConnectionPackage':
                if (!Auth::checkPermission($user, 'billing', 'create')) {
                    return ['ok' => false, 'error' => ['code' => 'FORBIDDEN', 'message' => 'Permission denied.']];
                }

                $custName = trim($payload['CustomerName'] ?? '');
                $mobile = trim($payload['Mobile'] ?? '');
                $address = trim($payload['Address'] ?? '');
                $custId = (int)($payload['CustomerID'] ?? 0);
                $packageItems = $payload['packageItems'] ?? ($payload['items'] ?? []);

                if (empty($custName) && $custId <= 0) {
                    return ['ok' => false, 'error' => ['code' => 'VALIDATION', 'message' => 'Customer name or selection is required for SV connection package.']];
                }

                $db->beginTransaction();
                try {
                    $now = date('Y-m-d H:i:s');
                    $datePrefix = date('Ymd');
                    $newCustId = $custId;

                    if ($newCustId <= 0) {
                        // Check if customer already exists with mobile
                        if (!empty($mobile)) {
                            $chk = $db->prepare("SELECT CustomerID FROM customers WHERE Mobile = ? AND IsDeleted = 0");
                            $chk->execute([$mobile]);
                            $foundId = $chk->fetchColumn();
                            if ($foundId) {
                                $newCustId = (int)$foundId;
                            }
                        }
                    }

                    if ($newCustId <= 0) {
                        // 1. Create Customer
                        $seqCust = (int)$db->query("SELECT COUNT(*) FROM customers")->fetchColumn() + 1;
                        $custCode = sprintf("CUST-%s-%04d", $datePrefix, $seqCust);

                        $insCust = $db->prepare("INSERT INTO customers (
                            CustomerCode, Name, Mobile, AltMobile, ConsumerNo, LPGID, Address, Area, Village,
                            ConnectionType, CylinderType, AadhaarLast4, Status, CreatedBy, CreatedAt, UpdatedAt
                        ) VALUES (
                            ?, ?, ?, ?, ?, ?, ?, ?, ?,
                            'NEW_SV', '14.2 KG Domestic', ?, 'ACTIVE', ?, ?, ?
                        )");
                        $insCust->execute([
                            $custCode, $custName, $mobile, $payload['AltMobile'] ?? '', $payload['ConsumerNo'] ?? '',
                            $payload['LPGID'] ?? '', $address, $payload['Area'] ?? '', $payload['Village'] ?? '',
                            $payload['AadhaarLast4'] ?? '', $user['userId'], $now, $now
                        ]);
                        $newCustId = (int)$db->lastInsertId();
                    }

                    // 2. Prepare items for POS bill
                    $payload['CustomerID'] = $newCustId;
                    $payload['CustomerName'] = $custName;
                    $payload['CustomerMobile'] = $mobile;
                    $payload['ConsumerNo'] = $payload['ConsumerNo'] ?? '';
                    $payload['items'] = $packageItems;

                    $db->commit(); // Commit customer creation first or pass to addBill

                    // Now call addBill
                    return self::handle('addBill', $payload, $user);
                } catch (Exception $e) {
                    if ($db->inTransaction()) $db->rollBack();
                    return ['ok' => false, 'error' => ['code' => 'SERVER', 'message' => 'Failed to issue new connection: ' . $e->getMessage()]];
                }

            case 'saveTvOutBill':
            case 'refundSecurityDeposit':
                if (!Auth::checkPermission($user, 'billing', 'create')) {
                    return ['ok' => false, 'error' => ['code' => 'FORBIDDEN', 'message' => 'Permission denied.']];
                }

                $custId = (int)($payload['CustomerID'] ?? 0);
                $custName = trim($payload['CustomerName'] ?? '');
                $mobile = trim($payload['CustomerMobile'] ?? ($payload['Mobile'] ?? ''));
                $consumerNo = trim($payload['ConsumerNo'] ?? '');
                $customerType = trim($payload['CustomerType'] ?? ($payload['CustType'] ?? 'DOMESTIC'));
                $cylType = trim($payload['CylinderType'] ?? '14.2 KG Domestic');
                $cylReturned = max(0, (int)($payload['CylindersReturned'] ?? 1));
                $regReturned = !empty($payload['RegulatorReturned']) ? (int)($payload['RegulatorReturned']) : 0;
                $passbookReturned = !empty($payload['PassbookReturned']) ? (int)($payload['PassbookReturned']) : 0;
                $cylDepositAmt = (float)($payload['CylinderDepositAmount'] ?? 0);
                $regDepositAmt = (float)($payload['RegulatorDepositAmount'] ?? 0);
                $svEra = trim($payload['OriginalSVEra'] ?? 'CURRENT');
                $securityAmt = (float)($payload['SecurityAmount'] ?? ($cylDepositAmt + $regDepositAmt));

                // Dedicated Deductions: TV Out Charge, Administration Charge, Imprest Fund
                $tvOutCharge = max(0, (float)($payload['TvOutCharge'] ?? 0));
                $adminCharge = max(0, (float)($payload['AdminCharge'] ?? 0));
                $imprestFund = max(0, (float)($payload['ImprestFund'] ?? 0));

                $deductionAmt = (float)($payload['DeductionAmount'] ?? ($tvOutCharge + $adminCharge + $imprestFund));
                if ($deductionAmt <= 0 && ($tvOutCharge + $adminCharge + $imprestFund) > 0) {
                    $deductionAmt = $tvOutCharge + $adminCharge + $imprestFund;
                }

                $refundAmt = (float)($payload['RefundAmount'] ?? max(0, $securityAmt - $deductionAmt));
                $payMode = strtoupper(trim($payload['PaymentMode'] ?? 'CASH'));
                $refNo = trim($payload['ReferenceNo'] ?? '');
                $reason = trim($payload['Reason'] ?? 'TV Out / SV Connection Surrender & Equipment Return');
                $refundDate = $payload['Date'] ?? date('Y-m-d');
                $voucherType = trim($payload['VoucherType'] ?? 'TV_OUT');

                if (empty($custName) || $refundAmt < 0) {
                    return ['ok' => false, 'error' => ['code' => 'VALIDATION', 'message' => 'Customer name and valid refund amount are required.']];
                }

                $db->beginTransaction();
                try {
                    $now = date('Y-m-d H:i:s');
                    $datePrefix = date('Ymd', strtotime($refundDate));
                    
                    // Generate Unique TV Out Voucher Number: TVO-YYYYMMDD-XXXX
                    $seqStmt = $db->prepare("SELECT COUNT(*) FROM security_refunds WHERE Date = ?");
                    $seqStmt->execute([$refundDate]);
                    $seq = (int)$seqStmt->fetchColumn() + 1;
                    $refundNumber = sprintf("TVO-%s-%04d", $datePrefix, $seq);

                    $refundPaise = (int)round($refundAmt * 100);

                    // 1. Insert into security_refunds
                    $ins = $db->prepare("INSERT INTO security_refunds (
                        RefundNumber, Date, CustomerID, CustomerName, CustomerMobile, ConsumerNo, CustomerType,
                        CylinderType, CylindersReturned, RegulatorReturned, PassbookReturned,
                        SecurityAmount, DeductionAmount, TvOutCharge, AdminCharge, ImprestFund,
                        RefundAmount, RefundAmountPaise, CylinderDepositAmount, RegulatorDepositAmount, OriginalSVEra,
                        PaymentMode, ReferenceNo, Reason, Status, VoucherType, CreatedBy, CreatedAt, UpdatedAt
                    ) VALUES (
                        ?, ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?, ?, ?, 'COMPLETED', ?, ?, ?, ?
                    )");
                    $ins->execute([
                        $refundNumber, $refundDate, $custId, $custName, $mobile, $consumerNo, $customerType,
                        $cylType, $cylReturned, $regReturned, $passbookReturned,
                        $securityAmt, $deductionAmt, $tvOutCharge, $adminCharge, $imprestFund,
                        $refundAmt, $refundPaise, $cylDepositAmt, $regDepositAmt, $svEra,
                        $payMode, $refNo, $reason, $voucherType, $user['userId'], $now, $now
                    ]);
                    $refundId = (int)$db->lastInsertId();

                    // 2. Adjust Cylinder Stock (Add returned empty cylinders to Godown)
                    if ($cylReturned > 0) {
                        $stk = $db->prepare("SELECT StockID, SoundEmptyReceived, ClosingEmpty FROM cylinder_stock WHERE Date = ? AND CylinderType = ?");
                        $stk->execute([$refundDate, $cylType]);
                        $stkRow = $stk->fetch();
                        if ($stkRow) {
                            $updStk = $db->prepare("UPDATE cylinder_stock SET 
                                SoundEmptyReceived = SoundEmptyReceived + ?,
                                ClosingEmpty = ClosingEmpty + ?,
                                UpdatedAt = ?
                                WHERE StockID = ?");
                            $updStk->execute([$cylReturned, $cylReturned, $now, $stkRow['StockID']]);
                        } else {
                            $prevStk = $db->prepare("SELECT ClosingFull, ClosingEmpty FROM cylinder_stock WHERE Date < ? AND CylinderType = ? ORDER BY Date DESC LIMIT 1");
                            $prevStk->execute([$refundDate, $cylType]);
                            $pRow = $prevStk->fetch() ?: ['ClosingFull' => 0, 'ClosingEmpty' => 0];

                            $insStk = $db->prepare("INSERT INTO cylinder_stock (
                                Date, CylinderType, OpeningFull, PlantReceipt, CounterSold, HawkerSold,
                                SoundEmptyReceived, ClosingFull, ClosingEmpty, CreatedBy, CreatedAt, UpdatedAt
                            ) VALUES (
                                ?, ?, ?, 0, 0, 0,
                                ?, ?, ?, ?, ?, ?
                            )");
                            $insStk->execute([
                                $refundDate, $cylType, $pRow['ClosingFull'],
                                $cylReturned, $pRow['ClosingFull'], $pRow['ClosingEmpty'] + $cylReturned,
                                $user['userId'], $now, $now
                            ]);
                        }

                        // Log Stock Movement
                        $insMov = $db->prepare("INSERT INTO stock_movements (
                            Date, CylinderType, MovementType, Quantity, FullOrEmpty, ReferenceNo, Reason, CreatedBy, CreatedAt
                        ) VALUES (
                            ?, ?, 'SV_SURRENDER_RETURN', ?, 'EMPTY', ?, ?, ?, ?
                        )");
                        $insMov->execute([
                            $refundDate, $cylType, $cylReturned, $refundNumber,
                            "Customer SV Surrender: $custName ($consumerNo)", $user['userId'], $now
                        ]);
                    }

                    // 3. Update Cashbook if Paid in Cash
                    if ($payMode === 'CASH') {
                        $cb = $db->prepare("SELECT CashbookID, Refunds, TotalOutflow, ExpectedClosing FROM cashbook WHERE Date = ?");
                        $cb->execute([$refundDate]);
                        $cbRow = $cb->fetch();
                        if ($cbRow) {
                            $updCb = $db->prepare("UPDATE cashbook SET 
                                Refunds = Refunds + ?,
                                TotalOutflow = TotalOutflow + ?,
                                ExpectedClosing = ExpectedClosing - ?,
                                UpdatedAt = ?
                                WHERE CashbookID = ?");
                            $updCb->execute([$refundAmt, $refundAmt, $refundAmt, $now, $cbRow['CashbookID']]);
                        } else {
                            $insCb = $db->prepare("INSERT INTO cashbook (
                                Date, OpeningCash, Refunds, TotalOutflow, ExpectedClosing, CreatedBy, CreatedAt, UpdatedAt
                            ) VALUES (
                                ?, 0, ?, ?, ?, ?, ?, ?
                            )");
                            $insCb->execute([$refundDate, $refundAmt, $refundAmt, -$refundAmt, $user['userId'], $now, $now]);
                        }
                    }

                    // 4. Update customer status if whole connection surrendered
                    if ($custId > 0) {
                        $updCust = $db->prepare("UPDATE customers SET 
                            Status = CASE WHEN ? >= 1 THEN 'SURRENDERED' ELSE Status END,
                            Notes = COALESCE(Notes, '') || ?
                            WHERE CustomerID = ?");
                        $noteAppend = "\n[" . date('Y-m-d') . "] Security refund $refundNumber of Rs $refundAmt processed ($reason).";
                        $updCust->execute([$cylReturned, $noteAppend, $custId]);
                    }

                    $db->commit();

                    Audit::log($user['userId'], $user['username'], 'SECURITY_REFUND', 'billing', (string)$refundId, null, [
                        'RefundNumber' => $refundNumber,
                        'Customer' => $custName,
                        'Amount' => $refundAmt,
                        'Mode' => $payMode
                    ], "Security deposit refund {$refundNumber} of Rs {$refundAmt} issued to {$custName}");

                    $fetchStmt = $db->prepare("SELECT * FROM security_refunds WHERE RefundID = ?");
                    $fetchStmt->execute([$refundId]);
                    $refundRecord = $fetchStmt->fetch();

                    return [
                        'ok' => true,
                        'data' => $refundRecord,
                        'message' => "Security deposit refund voucher {$refundNumber} for Rs {$refundAmt} recorded successfully."
                    ];
                } catch (Exception $e) {
                    if ($db->inTransaction()) $db->rollBack();
                    return ['ok' => false, 'error' => ['code' => 'SERVER', 'message' => 'Failed to process security refund: ' . $e->getMessage()]];
                }

            case 'listSecurityRefunds':
                $sql = "SELECT * FROM security_refunds ORDER BY RefundID DESC LIMIT 50";
                $stmt = $db->query($sql);
                return ['ok' => true, 'data' => $stmt->fetchAll()];

            default:
                return ['ok' => false, 'error' => ['code' => 'NOT_FOUND', 'message' => 'Invalid billing action.']];
        }
    }
}
