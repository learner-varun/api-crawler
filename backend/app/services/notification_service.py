import json
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import requests
from sqlalchemy.orm import Session
from backend.app.models.models import CommunicationSetting, ExecutionHistory, Environment, FailureDetails
from backend.app.utils.logger import get_logger

logger = get_logger("notification_service")

def get_active_config(db: Session) -> CommunicationSetting:
    config = db.query(CommunicationSetting).first()
    if not config:
        # Default disabled config
        config = CommunicationSetting(channel="none")
        db.add(config)
        db.commit()
        db.refresh(config)
    return config

def format_execution_report(db: Session, execution: ExecutionHistory) -> dict:
    """
    Formulates text, markdown, and HTML representations of the execution run report.
    """
    env = db.query(Environment).filter(Environment.id == execution.environment_id).first()
    env_name = env.name if env else f"Env ID {execution.environment_id}"
    env_url = env.base_url if env else ""
    
    status_emoji = "✅" if execution.status == "PASSED" else "🚨"
    title = f"{status_emoji} API Validation {execution.status} for {env_name}"
    
    # Load failures
    failures = db.query(FailureDetails).filter(FailureDetails.execution_id == execution.id).all()
    
    # 1. Plain Text Summary
    text_summary = (
        f"API Validation Run Report\n"
        f"==========================\n"
        f"Environment: {env_name} ({env_url})\n"
        f"Status: {execution.status}\n"
        f"Time: {execution.execution_time.strftime('%Y-%m-%d %H:%M:%S')} UTC\n"
        f"Total APIs: {execution.total_apis}\n"
        f"Passed: {execution.passed}\n"
        f"Failed: {execution.failed}\n\n"
    )
    if failures:
        text_summary += "Failed APIs Details:\n"
        for i, f in enumerate(failures, 1):
            text_summary += f"{i}. {f.api_name} - Reason: {f.failure_reason} (URL: {f.api_url})\n"
            
    # 2. Slack Markdown Summary
    slack_blocks = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"{status_emoji} API Validation {execution.status}",
                "emoji": True
            }
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Environment:*\n{env_name}"},
                {"type": "mrkdwn", "text": f"*Base URL:*\n<{env_url}|{env_url}>" if env_url else "N/A"},
                {"type": "mrkdwn", "text": f"*Status:*\n`{execution.status}`"},
                {"type": "mrkdwn", "text": f"*Time:*\n{execution.execution_time.strftime('%Y-%m-%d %H:%M:%S')} UTC"}
            ]
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Total APIs:*\n{execution.total_apis}"},
                {"type": "mrkdwn", "text": f"*Passed:*\n{execution.passed}"},
                {"type": "mrkdwn", "text": f"*Failed:*\n{execution.failed}"}
            ]
        }
    ]
    
    if failures:
        slack_blocks.append({"type": "divider"})
        failures_text = "*Failed APIs:*\n"
        # Limit Slack list to 10 failures to prevent payload overflow
        for i, f in enumerate(failures[:10], 1):
            failures_text += f"• *{f.api_name}*: {f.failure_reason}\n"
        if len(failures) > 10:
            failures_text += f"_...and {len(failures) - 10} more failures_"
        slack_blocks.append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": failures_text
            }
        })
        
    # 3. HTML Email body
    status_color = "#10b981" if execution.status == "PASSED" else "#ef4444"
    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f8fafc; color: #1e293b;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <div style="background-color: {status_color}; padding: 24px; text-align: center; color: #ffffff;">
                <h2 style="margin: 0; font-size: 22px; font-weight: bold;">{title}</h2>
            </div>
            <div style="padding: 24px; line-height: 1.6;">
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold; width: 40%;">Environment</td>
                        <td style="padding: 8px 0;">{env_name}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold;">Base URL</td>
                        <td style="padding: 8px 0;"><a href="{env_url}" style="color: #2563eb; text-decoration: none;">{env_url}</a></td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold;">Validation Status</td>
                        <td style="padding: 8px 0;"><span style="background-color: {status_color}1a; color: {status_color}; padding: 4px 8px; border-radius: 6px; font-weight: bold; font-size: 12px;">{execution.status}</span></td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold;">Execution Time</td>
                        <td style="padding: 8px 0;">{execution.execution_time.strftime('%Y-%m-%d %H:%M:%S')} UTC</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold;">API Statistics</td>
                        <td style="padding: 8px 0;">
                            <strong>Total:</strong> {execution.total_apis} | 
                            <span style="color: #10b981;">Passed: {execution.passed}</span> | 
                            <span style="color: #ef4444;">Failed: {execution.failed}</span>
                        </td>
                    </tr>
                </table>
    """
    if failures:
        html_body += f"""
                <div style="border-t: 1px solid #e2e8f0; margin-top: 20px; padding-top: 20px;">
                    <h3 style="margin-top: 0; color: #ef4444; font-size: 16px;">Failed APIs Details:</h3>
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                        <thead>
                            <tr style="background-color: #f1f5f9; text-align: left; border-bottom: 1px solid #cbd5e1;">
                                <th style="padding: 8px; font-weight: bold;">API Name</th>
                                <th style="padding: 8px; font-weight: bold;">Reason</th>
                                <th style="padding: 8px; font-weight: bold;">Endpoint</th>
                            </tr>
                        </thead>
                        <tbody>
        """
        for f in failures:
            html_body += f"""
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                                <td style="padding: 8px; font-weight: bold;">{f.api_name}</td>
                                <td style="padding: 8px; color: #ef4444;">{f.failure_reason}</td>
                                <td style="padding: 8px; font-family: monospace; font-size: 11px; word-break: break-all;">{f.api_url}</td>
                            </tr>
            """
        html_body += """
                        </tbody>
                    </table>
                </div>
        """
        
    html_body += """
            </div>
            <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
                Sent automatically by API Crawler validation engine.
            </div>
        </div>
    </body>
    </html>
    """
    
    return {
        "title": title,
        "text": text_summary,
        "slack_blocks": slack_blocks,
        "html": html_body
    }

def send_slack_notification(webhook_url: str, title: str, slack_blocks: list):
    payload = {
        "text": title,
        "blocks": slack_blocks
    }
    res = requests.post(webhook_url, json=payload, timeout=10)
    if res.status_code not in [200, 201]:
        raise ValueError(f"Slack webhook failed: {res.status_code} - {res.text}")

def send_teams_notification(webhook_url: str, title: str, text: str, execution_status: str):
    theme_color = "2EB67D" if execution_status == "PASSED" else "E01E5A"
    payload = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": theme_color,
        "summary": title,
        "sections": [{
            "activityTitle": title,
            "text": text.replace("\n", "<br>")
        }]
    }
    res = requests.post(webhook_url, json=payload, timeout=10)
    if res.status_code not in [200, 201]:
        raise ValueError(f"Teams webhook failed: {res.status_code} - {res.text}")

def send_email_notification(config: CommunicationSetting, title: str, text: str, html: str):
    # Construct email
    msg = MIMEMultipart("alternative")
    msg["Subject"] = title
    msg["From"] = config.sender_email
    msg["To"] = config.recipient_email
    
    part1 = MIMEText(text, "plain")
    part2 = MIMEText(html, "html")
    msg.attach(part1)
    msg.attach(part2)
    
    # Connect and send
    server = smtplib.SMTP(config.smtp_server, config.smtp_port)
    server.starttls()
    server.login(config.sender_email, config.sender_password)
    server.sendmail(config.sender_email, config.recipient_email, msg.as_string())
    server.quit()

def send_execution_notification(db: Session, execution: ExecutionHistory):
    """
    Checks the configured notification channel and sends a run report after an execution check completes.
    """
    config = get_active_config(db)
    if config.channel == "none":
        logger.info("Notification channel is set to 'none'. Skipping.")
        return

    logger.info(f"Preparing execution report for validation run {execution.id} via channel '{config.channel}'")
    report = format_execution_report(db, execution)

    try:
        if config.channel == "slack":
            send_slack_notification(config.webhook_url, report["title"], report["slack_blocks"])
        elif config.channel == "teams":
            send_teams_notification(config.webhook_url, report["title"], report["text"], execution.status)
        elif config.channel == "email":
            send_email_notification(config, report["title"], report["text"], report["html"])
        logger.info("Validation execution notification sent successfully.")
    except Exception as e:
        logger.error(f"Failed to send execution notification: {str(e)}")
        raise e

def send_test_notification_from_config(config: CommunicationSetting):
    """
    Dispatches a mock check report for channel connection verification.
    """
    title = f"📢 API Crawler Connection Test Notification"
    text = (
        "This is a mock check notification sent by API Crawler to verify your communication configurations.\n"
        "Status: CONNECTION_TEST_PASSED\n"
        "Connection state is active and report pipeline is healthy!"
    )
    html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f8fafc; color: #1e293b;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <div style="background-color: #2563eb; padding: 24px; text-align: center; color: #ffffff;">
                <h2 style="margin: 0; font-size: 22px; font-weight: bold;">API Crawler Notification System</h2>
            </div>
            <div style="padding: 24px; line-height: 1.6; text-align: center;">
                <h3 style="color: #2563eb; margin-top: 0;">Connection Test Passed!</h3>
                <p style="color: #64748b; font-size: 14px;">This is a test notification verifying your communication channel settings.</p>
                <div style="background-color: #f1f5f9; padding: 12px; border-radius: 8px; font-weight: 600; color: #1e293b; display: inline-block; margin-top: 10px;">
                    Connection Status: HEALTHY
                </div>
            </div>
            <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
                Sent automatically by API Crawler configuration tool.
            </div>
        </div>
    </body>
    </html>
    """
    
    if config.channel == "slack":
        slack_blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "📢 API Crawler Connection Test",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "This is a mock check notification sent by API Crawler to verify your channel configurations.\n\n*Status:* `CONNECTION_TEST_PASSED`\n*Connection:* `HEALTHY`"
                }
            }
        ]
        send_slack_notification(config.webhook_url, title, slack_blocks)
    elif config.channel == "teams":
        send_teams_notification(config.webhook_url, title, text, "PASSED")
    elif config.channel == "email":
        send_email_notification(config, title, text, html)
    else:
        raise ValueError("Cannot test a disabled notification channel configuration.")
