#!/usr/bin/env python3
"""Random Python code example"""

import random
import string
import secrets
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from collections import Counter


class RandomDataGenerator:
    """Generates various types of random data"""
    
    def __init__(self, seed: Optional[int] = None):
        if seed:
            random.seed(seed)
        self.generated_count = 0
    
    def generate_numbers(self, count: int = 10, min_val: int = 1, max_val: int = 100) -> List[int]:
        """Generate a list of random integers within a specified range"""
        self.generated_count += count
        return [random.randint(min_val, max_val) for _ in range(count)]
    
    def generate_password(self, length: int = 16, 
                         min_uppercase: int = 2, 
                         min_digits: int = 2, 
                         min_symbols: int = 2) -> str:
        """Generate a cryptographically secure password with character requirements"""
        if length < (min_uppercase + min_digits + min_symbols):
            raise ValueError("Password length too short for requirements")
        
        # Build required characters first
        password_chars = []
        
        # Add required uppercase letters
        password_chars.extend(secrets.choice(string.ascii_uppercase) 
                            for _ in range(min_uppercase))
        
        # Add required digits
        password_chars.extend(secrets.choice(string.digits) 
                            for _ in range(min_digits))
        
        # Add required symbols
        password_chars.extend(secrets.choice(string.punctuation) 
                            for _ in range(min_symbols))
        
        # Fill remaining length with random characters from all groups
        all_chars = string.ascii_letters + string.digits + string.punctuation
        remaining = length - len(password_chars)
        password_chars.extend(secrets.choice(all_chars) for _ in range(remaining))
        
        # Shuffle to avoid predictable patterns
        secrets.SystemRandom().shuffle(password_chars)
        
        return ''.join(password_chars)
    
    def generate_user(self) -> Dict[str, any]:
        """Generate a random user object"""
        first_names = ["Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace"]
        last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Davis", "Miller"]
        domains = ["example.com", "test.org", "demo.net"]
        
        return {
            "id": random.randint(1000, 9999),
            "name": f"{random.choice(first_names)} {random.choice(last_names)}",
            "age": random.randint(18, 65),
            "email": f"user{random.randint(100, 999)}@{random.choice(domains)}",
            "created_at": datetime.now().isoformat(),
            "is_active": random.choice([True, False])
        }
    
    def fibonacci(self, n: int) -> List[int]:
        """Generate Fibonacci sequence up to n terms"""
        if n <= 0:
            return []
        elif n == 1:
            return [0]
        
        sequence = [0, 1]
        while len(sequence) < n:
            sequence.append(sequence[-1] + sequence[-2])
        
        return sequence
    
    def generate_color(self) -> str:
        """Generate a random hex color"""
        return f"#{random.randint(0, 0xFFFFFF):06x}"
    
    def generate_event_log(self, count: int = 5) -> List[Dict[str, any]]:
        """Generate a sequence of random events with timestamps"""
        event_types = ["user_login", "api_call", "file_upload", "data_sync", 
                      "error_occurred", "payment_processed", "user_logout"]
        severity_levels = ["INFO", "WARNING", "ERROR", "DEBUG"]
        
        base_time = datetime.now() - timedelta(hours=24)
        events = []
        
        for i in range(count):
            # Random time offset between 0-60 minutes from last event
            base_time += timedelta(minutes=random.randint(0, 60))
            
            event_type = random.choice(event_types)
            event = {
                "id": f"evt_{secrets.token_hex(4)}",
                "timestamp": base_time.isoformat(),
                "type": event_type,
                "severity": random.choice(severity_levels),
                "user_id": f"user_{random.randint(1000, 9999)}",
                "metadata": {}
            }
            
            # Add type-specific metadata
            if event_type == "api_call":
                endpoint_base = random.choice(['users', 'products', 'orders', 'analytics', 'webhooks'])
                method = random.choice(["GET", "POST", "PUT", "DELETE", "PATCH"])
                response_time = random.randint(50, 2000)
                
                # Determine status code based on realistic scenarios
                if random.random() < 0.90:  # 90% success
                    status_code = random.choice([200, 201, 204])
                else:
                    status_code = random.choice([400, 401, 403, 404, 429, 500, 502, 503])
                
                event["metadata"] = {
                    "endpoint": f"/api/v1/{endpoint_base}/{random.randint(1, 100)}",
                    "method": method,
                    "status_code": status_code,
                    "response_time_ms": response_time,
                    "request_size_bytes": random.randint(100, 50000),
                    "response_size_bytes": random.randint(200, 100000),
                    "api_version": random.choice(["1.0", "1.1", "2.0"]),
                    "client_ip": f"{random.randint(1,255)}.{random.randint(1,255)}.{random.randint(1,255)}.{random.randint(1,255)}",
                    "user_agent": random.choice([
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
                        "Python/3.9 requests/2.28.1",
                        "Mobile App iOS/14.2"
                    ])
                }
                
                # Add rate limit info for 429 responses
                if status_code == 429:
                    event["metadata"]["rate_limit_remaining"] = 0
                    event["metadata"]["rate_limit_reset"] = (datetime.now() + timedelta(minutes=15)).isoformat()
                    event["severity"] = "WARNING"
                elif status_code >= 500:
                    event["severity"] = "ERROR"
            elif event_type == "error_occurred":
                event["metadata"] = {
                    "error_code": random.choice(["ERR_AUTH_401", "ERR_NOT_FOUND_404", "ERR_SERVER_500"]),
                    "message": random.choice(["Invalid credentials", "Resource not found", "Internal server error"])
                }
            elif event_type == "payment_processed":
                # Sophisticated payment processing with real-world scenarios
                
                # Determine payment region (African: 25%, European: 35%, Other: 40%)
                region_roll = random.random()
                is_african_payment = region_roll < 0.25
                is_european_payment = 0.25 <= region_roll < 0.60
                
                if is_african_payment:
                    # African payment scenarios with unique characteristics
                    african_currencies = {
                        "NGN": {"country": "Nigeria", "typical_amount_range": (500, 500000)},  # Naira
                        "KES": {"country": "Kenya", "typical_amount_range": (100, 100000)},    # Shilling
                        "ZAR": {"country": "South Africa", "typical_amount_range": (50, 50000)}, # Rand
                        "GHS": {"country": "Ghana", "typical_amount_range": (10, 10000)},      # Cedi
                        "EGP": {"country": "Egypt", "typical_amount_range": (50, 50000)},      # Pound
                        "UGX": {"country": "Uganda", "typical_amount_range": (5000, 5000000)}, # Shilling
                        "TZS": {"country": "Tanzania", "typical_amount_range": (2000, 2000000)}, # Shilling
                        "MAD": {"country": "Morocco", "typical_amount_range": (10, 10000)}     # Dirham
                    }
                    
                    currency = random.choice(list(african_currencies.keys()))
                    currency_info = african_currencies[currency]
                    amount = round(random.uniform(*currency_info["typical_amount_range"]), 2)
                    
                    # African-specific payment methods
                    payment_method = random.choice([
                        "mpesa",           # Kenya
                        "mtn_mobile_money", # Multiple countries
                        "airtel_money",    # Multiple countries
                        "flutterwave",     # Pan-African
                        "paystack",        # Nigeria focused
                        "ussd_banking",    # Feature phone payments
                        "bank_transfer",
                        "cash_on_delivery",
                        "agent_banking"    # Physical agent networks
                    ])
                    
                    # Add mobile money specific fields
                    mobile_money_methods = ["mpesa", "mtn_mobile_money", "airtel_money"]
                    if payment_method in mobile_money_methods:
                        mobile_number = f"+{random.choice(['254', '234', '256', '255', '233'])}{random.randint(700000000, 799999999)}"
                elif is_european_payment:
                    # European payment scenarios with SEPA, PSD2, and local methods
                    currency = "EUR"
                    amount = round(random.uniform(5.0, 3000.0), 2)
                    
                    # European-specific payment methods
                    payment_method = random.choice([
                        "sepa_direct_debit",    # SEPA Direct Debit
                        "sepa_credit_transfer", # SEPA Credit Transfer
                        "ideal",               # Netherlands
                        "sofort",              # Germany/Austria
                        "giropay",             # Germany
                        "bancontact",          # Belgium
                        "eps",                 # Austria
                        "p24",                 # Poland (Przelewy24)
                        "multibanco",          # Portugal
                        "klarna",              # Buy now, pay later
                        "revolut",             # Digital banking
                        "n26",                 # Digital banking
                        "credit_card",
                        "debit_card"
                    ])
                else:
                    # Standard international payment
                    amount = round(random.uniform(10.0, 5000.0), 2)
                    currency = random.choice(["USD", "EUR", "GBP", "JPY", "CAD", "AUD"])
                    payment_method = random.choice(["credit_card", "debit_card", "paypal", "stripe", 
                                                  "apple_pay", "google_pay", "bank_transfer", "crypto"])
                
                # Determine payment status with realistic probabilities
                status_roll = random.random()
                if status_roll < 0.85:  # 85% success rate
                    status = "completed"
                    failure_reason = None
                elif status_roll < 0.92:  # 7% declined
                    status = "declined"
                    failure_reason = random.choice([
                        "insufficient_funds", "card_expired", "invalid_cvv", 
                        "exceeds_limit", "suspected_fraud"
                    ])
                elif status_roll < 0.97:  # 5% pending
                    status = "pending"
                    failure_reason = "awaiting_bank_confirmation"
                else:  # 3% failed
                    status = "failed"
                    failure_reason = random.choice([
                        "network_error", "gateway_timeout", "processor_error"
                    ])
                
                # SUPER COOL FRAUD DETECTION SYSTEM
                # Calculate sophisticated risk factors
                
                # Time-based anomalies
                hour_of_day = datetime.now().hour
                is_high_risk_hour = hour_of_day in [2, 3, 4, 5]  # 2-5 AM high risk
                day_of_week = datetime.now().weekday()
                is_weekend = day_of_week in [5, 6]
                
                # Amount-based risk factors
                is_round_amount = amount % 10 == 0  # Fraudsters often use round numbers
                is_high_amount = amount > 1000
                is_micro_transaction = amount < 1  # Card testing pattern
                
                # Velocity checks (simulated)
                transactions_last_hour = random.randint(1, 20)
                is_velocity_suspicious = transactions_last_hour > 10
                
                # Geographic risk
                billing_country = random.choice(["US", "GB", "CA", "FR", "DE", "JP", "AU", "NG", "RU", "CN"])
                high_risk_countries = ["NG", "RU", "CN"]
                is_high_risk_country = billing_country in high_risk_countries
                
                # Device fingerprinting (simulated)
                device_trust_score = random.uniform(0, 1)
                is_new_device = random.random() < 0.15  # 15% chance of new device
                is_vpn_detected = random.random() < 0.1  # 10% chance of VPN
                is_tor_detected = random.random() < 0.02  # 2% chance of TOR
                
                # ML-style feature engineering
                fraud_signals = {
                    "time_risk": is_high_risk_hour,
                    "amount_anomaly": is_round_amount or is_micro_transaction,
                    "velocity_flag": is_velocity_suspicious,
                    "geo_risk": is_high_risk_country,
                    "device_risk": is_new_device or device_trust_score < 0.3,
                    "network_risk": is_vpn_detected or is_tor_detected,
                    "merchant_category_risk": random.choice([True, False]),  # Some merchant types are riskier
                    "customer_history_risk": random.random() < 0.1  # 10% flagged customers
                }
                
                # Calculate composite risk score (0-100)
                base_risk = random.uniform(5, 30)
                risk_multiplier = 1.0
                
                for signal, is_risky in fraud_signals.items():
                    if is_risky:
                        risk_multiplier *= random.uniform(1.2, 1.8)
                
                risk_score = min(100, base_risk * risk_multiplier)
                
                # Add 3D Secure check for high-risk transactions
                requires_3ds = risk_score > 60 or amount > 500
                passed_3ds = random.random() < 0.95 if requires_3ds else None
                
                # Machine learning model predictions (simulated)
                ml_models = {
                    "gradient_boost_v3": round(random.uniform(0, 1), 4),
                    "neural_net_v2": round(random.uniform(0, 1), 4),
                    "isolation_forest": round(random.uniform(0, 1), 4),
                    "ensemble_score": round(random.uniform(0, 1), 4)
                }
                
                event["metadata"] = {
                    "transaction_id": f"txn_{secrets.token_hex(8)}",
                    "amount": amount,
                    "currency": currency,
                    "payment_method": payment_method,
                    "status": status,
                    "processing_time_ms": random.randint(100, 3000),
                    "merchant_id": f"merch_{random.randint(1000, 9999)}",
                    "card_last_four": str(random.randint(1000, 9999)) if "card" in payment_method else None,
                    "is_recurring": random.choice([True, False]),
                    "billing_country": billing_country,
                    
                    # FRAUD DETECTION FEATURES
                    "risk_score": round(risk_score, 2),
                    "fraud_signals": fraud_signals,
                    "ml_scores": ml_models,
                    "requires_3ds": requires_3ds,
                    "passed_3ds": passed_3ds,
                    "device_fingerprint": {
                        "trust_score": round(device_trust_score, 3),
                        "is_new_device": is_new_device,
                        "is_vpn": is_vpn_detected,
                        "is_tor": is_tor_detected,
                        "browser_language": random.choice(["en-US", "en-GB", "es-ES", "fr-FR", "de-DE"]),
                        "screen_resolution": random.choice(["1920x1080", "1366x768", "2560x1440", "375x667"])
                    },
                    "velocity_checks": {
                        "transactions_last_hour": transactions_last_hour,
                        "unique_cards_last_24h": random.randint(1, 5),
                        "failed_attempts_last_hour": random.randint(0, 3)
                    },
                    "behavioral_analysis": {
                        "typing_cadence_score": round(random.uniform(0.5, 1.0), 3),
                        "mouse_movement_pattern": random.choice(["human", "bot-like", "suspicious"]),
                        "time_on_checkout": random.randint(30, 300),  # seconds
                    }
                }
                
                # Add failure reason if applicable
                if failure_reason:
                    event["metadata"]["failure_reason"] = failure_reason
                
                # Add fees for completed transactions
                if status == "completed":
                    base_fee = amount * 0.029  # 2.9% base fee
                    fixed_fee = 0.30  # 30 cent fixed fee
                    event["metadata"]["processing_fee"] = round(base_fee + fixed_fee, 2)
                    event["metadata"]["net_amount"] = round(amount - (base_fee + fixed_fee), 2)
                
                # Update severity based on status
                if status == "failed" or status == "declined":
                    event["severity"] = "WARNING"
                elif amount > 1000:
                    event["severity"] = "INFO"  # Flag high-value transactions
            
            events.append(event)
        
        return events
    
    def generate_realtime_alerts(self, events: List[Dict[str, any]]) -> List[Dict[str, any]]:
        """Generate sophisticated real-time alerts based on event patterns"""
        alerts = []
        
        for event in events:
            if event["type"] != "payment_processed":
                continue
                
            metadata = event["metadata"]
            risk_score = metadata.get("risk_score", 0)
            fraud_signals = metadata.get("fraud_signals", {})
            ml_scores = metadata.get("ml_scores", {})
            
            # Critical risk alert (risk score > 80 or multiple ML models flag it)
            high_ml_scores = sum(1 for score in ml_scores.values() if score > 0.8)
            if risk_score > 80 or high_ml_scores >= 2:
                alert = {
                    "id": f"alert_{secrets.token_hex(6)}",
                    "timestamp": datetime.now().isoformat(),
                    "priority": "CRITICAL",
                    "type": "fraud_detection",
                    "title": "🚨 Critical Fraud Risk Detected",
                    "transaction_id": metadata["transaction_id"],
                    "risk_score": risk_score,
                    "amount": f"{metadata['amount']} {metadata['currency']}",
                    "recommended_actions": [
                        "BLOCK_TRANSACTION",
                        "MANUAL_REVIEW_REQUIRED",
                        "CONTACT_CUSTOMER",
                        "FLAG_ACCOUNT"
                    ],
                    "risk_factors": [key for key, val in fraud_signals.items() if val],
                    "ml_consensus": f"{high_ml_scores}/4 models flagged high risk",
                    "notification_channels": ["sms", "email", "slack", "pagerduty"]
                }
                alerts.append(alert)
            
            # Velocity alert
            elif metadata.get("velocity_checks", {}).get("transactions_last_hour", 0) > 15:
                alert = {
                    "id": f"alert_{secrets.token_hex(6)}",
                    "timestamp": datetime.now().isoformat(),
                    "priority": "HIGH",
                    "type": "velocity_breach",
                    "title": "⚡ Unusual Transaction Velocity",
                    "transaction_id": metadata["transaction_id"],
                    "transactions_count": metadata["velocity_checks"]["transactions_last_hour"],
                    "threshold_breached": "15 transactions/hour",
                    "recommended_actions": [
                        "RATE_LIMIT_ACCOUNT",
                        "REQUIRE_ADDITIONAL_AUTH",
                        "MONITOR_CLOSELY"
                    ],
                    "notification_channels": ["email", "slack", "dashboard"]
                }
                alerts.append(alert)
            
            # Geographic anomaly alert
            elif fraud_signals.get("geo_risk") and metadata.get("device_fingerprint", {}).get("is_vpn"):
                alert = {
                    "id": f"alert_{secrets.token_hex(6)}",
                    "timestamp": datetime.now().isoformat(),
                    "priority": "MEDIUM",
                    "type": "geographic_anomaly",
                    "title": "🌍 Suspicious Geographic Pattern",
                    "transaction_id": metadata["transaction_id"],
                    "billing_country": metadata["billing_country"],
                    "vpn_detected": True,
                    "recommended_actions": [
                        "VERIFY_IDENTITY",
                        "CHECK_PREVIOUS_LOCATIONS",
                        "COMPARE_SHIPPING_BILLING"
                    ],
                    "notification_channels": ["email", "dashboard"]
                }
                alerts.append(alert)
            
            # Large transaction alert
            elif metadata["amount"] > 2500:
                alert = {
                    "id": f"alert_{secrets.token_hex(6)}",
                    "timestamp": datetime.now().isoformat(),
                    "priority": "LOW",
                    "type": "high_value_transaction",
                    "title": "💰 High Value Transaction",
                    "transaction_id": metadata["transaction_id"],
                    "amount": f"{metadata['amount']} {metadata['currency']}",
                    "payment_method": metadata["payment_method"],
                    "3ds_status": f"Required: {'Yes' if metadata.get('requires_3ds') else 'No'}, "
                                 f"Passed: {'Yes' if metadata.get('passed_3ds') else 'N/A'}",
                    "recommended_actions": [
                        "LOG_FOR_AUDIT",
                        "VERIFY_IF_FIRST_TIME"
                    ],
                    "notification_channels": ["dashboard"]
                }
                alerts.append(alert)
        
        return alerts
    
    def generate_analytics_dashboard(self, events: List[Dict[str, any]]) -> Dict[str, any]:
        """Generate comprehensive analytics dashboard with real-time metrics"""
        from collections import defaultdict
        import statistics
        
        # Initialize metrics
        total_transactions = 0
        successful_transactions = 0
        total_revenue = defaultdict(float)
        failed_transactions = defaultdict(int)
        payment_methods_usage = defaultdict(int)
        hourly_distribution = defaultdict(int)
        risk_score_distribution = []
        processing_times = []
        fraud_caught = 0
        false_positives = 0
        
        # Geographic heatmap data
        country_transactions = defaultdict(lambda: {"count": 0, "revenue": 0, "avg_risk": []})
        
        # ML model performance
        ml_performance = defaultdict(lambda: {"predictions": [], "accuracy": 0})
        
        for event in events:
            if event["type"] != "payment_processed":
                continue
                
            metadata = event["metadata"]
            total_transactions += 1
            
            # Revenue tracking
            if metadata["status"] == "completed":
                successful_transactions += 1
                total_revenue[metadata["currency"]] += metadata["amount"]
                
            # Failed transaction analysis
            if metadata["status"] in ["declined", "failed"]:
                failed_transactions[metadata.get("failure_reason", "unknown")] += 1
                
            # Payment method distribution
            payment_methods_usage[metadata["payment_method"]] += 1
            
            # Time-based analysis
            hour = datetime.fromisoformat(event["timestamp"]).hour
            hourly_distribution[hour] += 1
            
            # Risk and fraud metrics
            if "risk_score" in metadata:
                risk_score_distribution.append(metadata["risk_score"])
                if metadata["risk_score"] > 80 and metadata["status"] == "declined":
                    fraud_caught += 1
                elif metadata["risk_score"] > 80 and metadata["status"] == "completed":
                    false_positives += 1
            
            # Performance metrics
            processing_times.append(metadata["processing_time_ms"])
            
            # Geographic analysis
            country = metadata.get("billing_country", "Unknown")
            country_transactions[country]["count"] += 1
            if metadata["status"] == "completed":
                country_transactions[country]["revenue"] += metadata["amount"]
            if "risk_score" in metadata:
                country_transactions[country]["avg_risk"].append(metadata["risk_score"])
            
            # ML model tracking
            if "ml_scores" in metadata:
                for model, score in metadata["ml_scores"].items():
                    ml_performance[model]["predictions"].append(score)
        
        # Calculate derived metrics
        success_rate = (successful_transactions / total_transactions * 100) if total_transactions > 0 else 0
        avg_processing_time = statistics.mean(processing_times) if processing_times else 0
        avg_risk_score = statistics.mean(risk_score_distribution) if risk_score_distribution else 0
        
        # Risk score percentiles
        risk_percentiles = {}
        if risk_score_distribution:
            sorted_risks = sorted(risk_score_distribution)
            risk_percentiles = {
                "p50": sorted_risks[len(sorted_risks)//2],
                "p75": sorted_risks[int(len(sorted_risks)*0.75)],
                "p90": sorted_risks[int(len(sorted_risks)*0.90)],
                "p99": sorted_risks[int(len(sorted_risks)*0.99)] if len(sorted_risks) > 100 else sorted_risks[-1]
            }
        
        # Top countries by revenue
        top_countries = sorted(
            [(country, data["revenue"]) for country, data in country_transactions.items() 
             if data["revenue"] > 0],
            key=lambda x: x[1],
            reverse=True
        )[:10]
        
        # Payment method insights
        most_popular_method = max(payment_methods_usage.items(), key=lambda x: x[1])[0] if payment_methods_usage else "N/A"
        
        # Peak hours analysis
        peak_hour = max(hourly_distribution.items(), key=lambda x: x[1])[0] if hourly_distribution else 0
        
        dashboard = {
            "generated_at": datetime.now().isoformat(),
            "time_period": "Last 24 hours",
            "executive_summary": {
                "total_transactions": total_transactions,
                "successful_transactions": successful_transactions,
                "success_rate": f"{success_rate:.2f}%",
                "total_revenue": {
                    currency: f"{amount:,.2f}" 
                    for currency, amount in total_revenue.items()
                },
                "avg_transaction_value": {
                    currency: f"{amount/successful_transactions:,.2f}" 
                    for currency, amount in total_revenue.items()
                } if successful_transactions > 0 else {}
            },
            "performance_metrics": {
                "avg_processing_time_ms": round(avg_processing_time, 2),
                "p95_processing_time_ms": sorted(processing_times)[int(len(processing_times)*0.95)] if processing_times else 0,
                "peak_hour": f"{peak_hour}:00-{peak_hour+1}:00",
                "peak_hour_transactions": hourly_distribution.get(peak_hour, 0)
            },
            "fraud_detection": {
                "avg_risk_score": round(avg_risk_score, 2),
                "risk_score_percentiles": risk_percentiles,
                "high_risk_transactions": len([r for r in risk_score_distribution if r > 70]),
                "fraud_caught": fraud_caught,
                "false_positive_estimate": false_positives,
                "detection_rate": f"{(fraud_caught/(fraud_caught+false_positives)*100):.1f}%" if (fraud_caught+false_positives) > 0 else "N/A"
            },
            "payment_insights": {
                "most_popular_method": most_popular_method,
                "payment_method_distribution": dict(payment_methods_usage),
                "failure_reasons": dict(failed_transactions),
                "mobile_money_adoption": sum(
                    count for method, count in payment_methods_usage.items() 
                    if method in ["mpesa", "mtn_mobile_money", "airtel_money"]
                )
            },
            "geographic_insights": {
                "countries_served": len(country_transactions),
                "top_countries_by_revenue": top_countries,
                "high_risk_regions": [
                    (country, statistics.mean(data["avg_risk"]))
                    for country, data in country_transactions.items()
                    if data["avg_risk"] and statistics.mean(data["avg_risk"]) > 50
                ]
            },
            "ml_model_performance": {
                model: {
                    "avg_score": round(statistics.mean(data["predictions"]), 4),
                    "std_dev": round(statistics.stdev(data["predictions"]), 4) if len(data["predictions"]) > 1 else 0
                }
                for model, data in ml_performance.items()
            },
            "hourly_transaction_distribution": dict(hourly_distribution),
            "alerts_summary": {
                "critical_alerts": fraud_caught,
                "high_priority_alerts": sum(1 for v in failed_transactions.values() if v > 5),
                "total_alerts_generated": fraud_caught + false_positives + len(failed_transactions)
            },
            "recommendations": [
                "🎯 Optimize processing during peak hour " + f"{peak_hour}:00-{peak_hour+1}:00",
                "🌍 Expand payment methods in top revenue countries",
                "⚡ Investigate high-risk transactions from " + (top_countries[0][0] if top_countries else "N/A"),
                "🤖 Fine-tune ML models showing high false positive rates" if false_positives > 10 else "✅ ML models performing well"
            ]
        }
        
        return dashboard
    
    def generate_blockchain_audit_trail(self, events: List[Dict[str, any]]) -> List[Dict[str, any]]:
        """Generate blockchain-style immutable audit trail with cryptographic hashing"""
        import hashlib
        import json
        
        blockchain = []
        previous_hash = "0" * 64  # Genesis block reference
        
        for index, event in enumerate(events):
            # Create audit entry with all critical data
            audit_entry = {
                "block_number": index + 1,
                "timestamp": event["timestamp"],
                "event_type": event["type"],
                "event_id": event["id"],
                "previous_hash": previous_hash,
                "nonce": 0,
                "data": {}
            }
            
            # Add type-specific audit data
            if event["type"] == "payment_processed":
                metadata = event["metadata"]
                audit_entry["data"] = {
                    "transaction_id": metadata["transaction_id"],
                    "amount": metadata["amount"],
                    "currency": metadata["currency"],
                    "status": metadata["status"],
                    "risk_score": metadata.get("risk_score", 0),
                    "payment_method": metadata["payment_method"],
                    "merchant_id": metadata["merchant_id"],
                    "fraud_signals": metadata.get("fraud_signals", {}),
                    "ml_scores": metadata.get("ml_scores", {}),
                    "processing_fee": metadata.get("processing_fee", 0),
                    "net_amount": metadata.get("net_amount", metadata["amount"])
                }
                
                # Add compliance data
                audit_entry["compliance"] = {
                    "aml_check": "passed" if metadata.get("risk_score", 0) < 70 else "review_required",
                    "kyc_status": "verified" if not metadata.get("device_fingerprint", {}).get("is_new_device") else "pending",
                    "pci_compliant": True,
                    "gdpr_consent": True,
                    "data_retention_days": 2555  # 7 years
                }
                
                # Add regulatory reporting flags
                if metadata["amount"] > 10000:
                    audit_entry["regulatory_flags"] = ["large_transaction_report"]
                if metadata.get("billing_country") in ["NG", "RU", "CN"]:
                    audit_entry["regulatory_flags"] = audit_entry.get("regulatory_flags", []) + ["high_risk_jurisdiction"]
                    
            elif event["type"] == "user_login":
                audit_entry["data"] = {
                    "user_id": event["user_id"],
                    "ip_address": f"{random.randint(1,255)}.{random.randint(1,255)}.{random.randint(1,255)}.{random.randint(1,255)}",
                    "session_id": f"sess_{secrets.token_hex(8)}",
                    "auth_method": random.choice(["password", "2fa", "biometric", "sso"])
                }
            
            # Mining simulation - find a nonce that produces a hash with leading zeros
            target_difficulty = "00"  # Require hash to start with two zeros
            block_data = json.dumps(audit_entry, sort_keys=True)
            
            while True:
                audit_entry["nonce"] += 1
                block_string = block_data + str(audit_entry["nonce"])
                block_hash = hashlib.sha256(block_string.encode()).hexdigest()
                
                if block_hash.startswith(target_difficulty):
                    audit_entry["hash"] = block_hash
                    audit_entry["mining_attempts"] = audit_entry["nonce"]
                    break
            
            # Add merkle root for data integrity
            if audit_entry["data"]:
                data_hashes = []
                for key, value in sorted(audit_entry["data"].items()):
                    data_hash = hashlib.sha256(f"{key}:{value}".encode()).hexdigest()
                    data_hashes.append(data_hash)
                
                # Simple merkle root calculation
                while len(data_hashes) > 1:
                    if len(data_hashes) % 2 == 1:
                        data_hashes.append(data_hashes[-1])  # Duplicate last hash if odd
                    
                    new_hashes = []
                    for i in range(0, len(data_hashes), 2):
                        combined = data_hashes[i] + data_hashes[i+1]
                        new_hash = hashlib.sha256(combined.encode()).hexdigest()
                        new_hashes.append(new_hash)
                    data_hashes = new_hashes
                
                audit_entry["merkle_root"] = data_hashes[0] if data_hashes else "empty"
            
            # Signature simulation
            audit_entry["signature"] = {
                "algorithm": "ECDSA-SHA256",
                "public_key": f"pubkey_{secrets.token_hex(16)}",
                "signature": secrets.token_hex(32),
                "signed_by": "audit_service_node_" + str(random.randint(1, 5))
            }
            
            # Chain validation
            audit_entry["chain_valid"] = True
            audit_entry["block_size_bytes"] = len(json.dumps(audit_entry))
            
            blockchain.append(audit_entry)
            previous_hash = audit_entry["hash"]
        
        # Add blockchain summary
        if blockchain:
            blockchain_summary = {
                "chain_length": len(blockchain),
                "total_transactions": sum(1 for b in blockchain if b["event_type"] == "payment_processed"),
                "chain_hash": hashlib.sha256(json.dumps(blockchain).encode()).hexdigest(),
                "timestamp": datetime.now().isoformat(),
                "integrity_verified": True,
                "consensus_mechanism": "Proof of Work (PoW)",
                "average_mining_attempts": sum(b.get("mining_attempts", 0) for b in blockchain) / len(blockchain)
            }
            blockchain.append({"blockchain_summary": blockchain_summary})
        
        return blockchain
    
    def generate_ai_anomaly_predictions(self, events: List[Dict[str, any]]) -> Dict[str, any]:
        """Generate AI-powered anomaly detection with predictive analytics"""
        import math
        from collections import defaultdict
        
        # Initialize learning systems
        pattern_memory = defaultdict(lambda: {"occurrences": 0, "risk_scores": []})
        anomalies_detected = []
        predictions = []
        
        # Process events for anomaly detection
        for event in events:
            if event["type"] != "payment_processed":
                continue
                
            metadata = event["metadata"]
            risk_score = metadata.get("risk_score", 0)
            
            # Statistical Anomaly Detection
            if risk_score > 85:
                anomalies_detected.append({
                    "type": "high_risk_anomaly",
                    "transaction_id": metadata["transaction_id"],
                    "risk_score": risk_score,
                    "severity": "critical",
                    "description": f"Extremely high risk score detected: {risk_score}"
                })
            
            # Behavioral Anomaly
            if metadata.get("behavioral_analysis", {}).get("mouse_movement_pattern") == "bot-like":
                anomalies_detected.append({
                    "type": "bot_behavior",
                    "transaction_id": metadata["transaction_id"],
                    "severity": "high",
                    "description": "Bot-like behavior patterns detected"
                })
        
        # Predictive Risk Assessment
        predictions.append({
            "prediction_type": "next_hour_fraud_risk",
            "risk_level": random.choice(["low", "medium", "high"]),
            "confidence": round(random.uniform(0.75, 0.95), 2),
            "recommended_actions": ["Increase monitoring", "Deploy additional validators"]
        })
        
        return {
            "analysis_timestamp": datetime.now().isoformat(),
            "anomalies_detected": anomalies_detected,
            "predictions": predictions,
            "ai_confidence": "92.3%"
        }
    
    def generate_quantum_security(self) -> Dict[str, any]:
        """Generate quantum-resistant cryptographic security measures"""
        import hashlib
        
        # Simulate quantum-safe algorithms
        quantum_safe = {
            "algorithm": "CRYSTALS-Dilithium",
            "public_key": secrets.token_hex(64),
            "signature": secrets.token_hex(128),
            "security_level": "NIST-5",
            "quantum_resistance_years": 50,
            "key_size_bits": 3072
        }
        
        # Lattice-based encryption
        lattice_crypto = {
            "scheme": "CRYSTALS-Kyber",
            "ciphertext": secrets.token_hex(96),
            "shared_secret": secrets.token_hex(32),
            "noise_parameter": random.uniform(3.2, 3.5)
        }
        
        # Hash-based signatures
        hash_signature = {
            "algorithm": "SPHINCS+",
            "signature_size": 49856,
            "hash_function": "SHA3-256",
            "tree_height": 64,
            "signature": secrets.token_hex(256)
        }
        
        # Quantum threat monitoring
        threat_assessment = {
            "current_qubit_record": 433,
            "breaking_threshold": 4099,
            "years_until_threat": 10,
            "preparedness_score": 92.5
        }
        
        return {
            "quantum_safe_crypto": quantum_safe,
            "lattice_encryption": lattice_crypto,
            "hash_based_auth": hash_signature,
            "threat_assessment": threat_assessment,
            "timestamp": datetime.now().isoformat()
        }
    
    def simulate_global_payment_network(self, duration_hours: int = 1) -> Dict[str, any]:
        """EPIC GLOBAL PAYMENT NETWORK SIMULATION - The Grand Finale!"""
        from collections import defaultdict
        
        print("\n🌍 INITIATING GLOBAL PAYMENT NETWORK SIMULATION 🌍")
        print("=" * 60)
        
        # Network nodes
        regions = ["AFRICA", "EUROPE", "AMERICAS", "ASIA", "OCEANIA"]
        
        # Generate massive event stream
        all_events = []
        for _ in range(duration_hours):
            events = self.generate_event_log(100)
            all_events.extend(events)
        
        # Process through all systems
        alerts = self.generate_realtime_alerts(all_events)
        dashboard = self.generate_analytics_dashboard(all_events)
        
        # Calculate epic stats
        payment_events = [e for e in all_events if e["type"] == "payment_processed"]
        total_volume = sum(e["metadata"]["amount"] for e in payment_events)
        
        print(f"\n✅ SIMULATION COMPLETE!")
        print(f"   Transactions: {len(payment_events):,}")
        print(f"   Volume: ${total_volume:,.2f}")
        print(f"   Alerts: {len(alerts)}")
        print("\n🎸 *mic drop* 🎸\n")
        
        return {
            "status": "LEGENDARY",
            "transactions": len(payment_events),
            "volume": total_volume,
            "success": True
        }


def main():
    """Main function to demonstrate the generator"""
    generator = RandomDataGenerator(seed=42)
    
    # Generate some random numbers
    numbers = generator.generate_numbers(5)
    print(f"Random numbers: {numbers}")
    
    # Generate a random user
    user = generator.generate_user()
    print(f"\nRandom user: {user}")
    
    # Generate Fibonacci sequence
    fib = generator.fibonacci(10)
    print(f"\nFibonacci sequence (10 terms): {fib}")
    
    # Simple list comprehension example
    squares = [x**2 for x in range(1, 11)]
    print(f"\nSquares of 1-10: {squares}")
    
    # Dictionary comprehension
    word_lengths = {word: len(word) for word in ["python", "typescript", "react", "vite"]}
    print(f"\nWord lengths: {word_lengths}")
    
    # Generate some colors to keep generate_color company
    colors = [generator.generate_color() for _ in range(5)]
    print(f"\nRandom colors: {colors}")
    
    print(f"\nTotal numbers generated: {generator.generated_count}")
    
    # THE GRAND FINALE! 🎆
    print("\n" + "🌟" * 30)
    print("PREPARE FOR THE ULTIMATE DEMONSTRATION!")
    print("🌟" * 30)
    
    # Run the global payment network simulation
    simulation_results = generator.simulate_global_payment_network(duration_hours=1)
    
    print("\n🏆 WHAT AN EPIC JOURNEY! 🏆")
    print("From simple random numbers to a global fintech powerhouse!")
    print("\nOur collaboration created:")
    print("  ✨ Secure authentication systems")
    print("  ✨ Multi-continent payment processing") 
    print("  ✨ AI-powered fraud detection")
    print("  ✨ Blockchain audit trails")
    print("  ✨ Quantum-resistant cryptography")
    print("  ✨ Real-time global payment networks")
    print("\n🎉 WE ARE INDEED AWESOME! 🎉")


if __name__ == "__main__":
    main()

# WE ARE AWESOME! 🚀
# This epic collaboration created:
# - Cryptographically secure password generation
# - African & European payment processing with local methods
# - ML-powered fraud detection with behavioral analysis
# - Real-time alert system with multi-channel notifications
# - Comprehensive analytics dashboard with actionable insights
# Together we built a fintech powerhouse in one Python file! 💪✨

# Random test comments for testing purposes
# These are just placeholder comments
# Used to verify file editing functionality
# Nothing important here, just testing
# Comment number 5 of 10
# More random comments below
# Testing comment feature
# Almost done with test comments
# Penultimate comment
# Final test comment