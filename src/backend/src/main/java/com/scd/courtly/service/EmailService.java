package com.scd.courtly.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import jakarta.mail.internet.MimeMessage;
import javax.naming.directory.Attributes;
import javax.naming.directory.DirContext;
import javax.naming.directory.InitialDirContext;
import java.util.Hashtable;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromAddress;

    private static final Map<String, String[]> TYPE_META = Map.ofEntries(
        Map.entry("NEW_REGISTRATION",  new String[]{"#10b981", "🎉"}),
        Map.entry("BOOKING_MADE",      new String[]{"#6366f1", "📅"}),
        Map.entry("BOOKING_CONFIRMED", new String[]{"#10b981", "✅"}),
        Map.entry("BOOKING_CANCELLED", new String[]{"#ef4444", "❌"}),
        Map.entry("BOOKING_COMPLETED", new String[]{"#14b8a6", "🏁"}),
        Map.entry("BOOKING_EXPIRED",   new String[]{"#f97316", "⏰"}),
        Map.entry("SLOT_STARTING",     new String[]{"#a855f7", "🔔"}),
        Map.entry("LOW_RATING",        new String[]{"#eab308", "⭐"}),
        Map.entry("DELETION_REQUEST",  new String[]{"#ef4444", "🗑️"})
    );

    /**
     * Sends an HTML notification email. Runs synchronously so any SMTP error
     * appears immediately in the console log.
     *
     * @return true if sent successfully, false otherwise
     */
    public boolean sendNotificationEmail(String toEmail, String type, String title, String message) {
        if (!domainHasMxRecord(toEmail)) {
            log.debug("Email skipped for {} — no mail server on domain", toEmail);
            return false;
        }
        try {
            String[] meta      = TYPE_META.getOrDefault(type, new String[]{"#6366f1", "🔔"});
            String accentColor = meta[0];
            String icon        = meta[1];

            MimeMessage mime = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mime, true, "UTF-8");
            helper.setFrom(fromAddress, "Courtly Notifications");
            helper.setTo(toEmail);
            helper.setSubject(icon + " " + title + " | Courtly");
            helper.setText(buildHtml(icon, accentColor, type, title, message), true);

            mailSender.send(mime);
            log.info("✅ Email sent → {} [{}]", toEmail, type);
            return true;

        } catch (Exception e) {
            log.debug("Email skipped for {} [{}]: {}", toEmail, type, e.getMessage());
            return false;
        }
    }

    public boolean sendOtpEmail(String toEmail, String otp) {
        if (!domainHasMxRecord(toEmail)) {
            log.debug("OTP email skipped for {} — no mail server on domain", toEmail);
            return false;
        }
        try {
            MimeMessage mime = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mime, true, "UTF-8");
            helper.setFrom(fromAddress, "Courtly Security");
            helper.setTo(toEmail);
            helper.setSubject("🔐 Your Courtly Password Reset Code: " + otp);
            helper.setText(buildOtpHtml(otp), true);
            mailSender.send(mime);
            log.info("✅ OTP email sent → {}", toEmail);
            return true;
        } catch (Exception e) {
            log.debug("OTP email failed for {}: {}", toEmail, e.getMessage());
            return false;
        }
    }

    private String buildOtpHtml(String otp) {
        return "<!DOCTYPE html><html><head><meta charset='UTF-8'></head>" +
            "<body style='margin:0;padding:0;background:#0f172a;font-family:Segoe UI,Arial,sans-serif'>" +
            "<div style='max-width:500px;margin:40px auto;background:#1e293b;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.5)'>" +
            "<div style='background:#3b82f6;padding:28px 32px;text-align:center'>" +
            "<h1 style='color:#fff;margin:0;font-size:22px;letter-spacing:.5px'>🔐 Courtly</h1>" +
            "<div style='color:rgba(255,255,255,.8);font-size:13px;margin-top:4px'>Password Reset Code</div>" +
            "</div>" +
            "<div style='padding:32px;text-align:center'>" +
            "<p style='color:#94a3b8;font-size:15px;margin:0 0 24px'>Your one-time password (OTP) is:</p>" +
            "<div style='display:inline-block;background:#0f172a;border:2px solid #3b82f6;border-radius:12px;padding:16px 40px;margin:0 0 24px'>" +
            "<span style='color:#60a5fa;font-size:36px;font-weight:900;letter-spacing:10px'>" + otp + "</span>" +
            "</div>" +
            "<p style='color:#64748b;font-size:13px;margin:0'>This code expires in <strong style=\"color:#94a3b8\">10 minutes</strong>.<br>" +
            "If you didn't request this, you can safely ignore this email.</p>" +
            "</div>" +
            "<div style='background:#0f172a;padding:20px 32px;text-align:center;color:#475569;font-size:12px'>" +
            "&copy; 2026 Courtly &mdash; All rights reserved." +
            "</div></div></body></html>";
    }

    private boolean domainHasMxRecord(String email) {
        try {
            int at = email.lastIndexOf('@');
            if (at < 0) return false;
            String domain = email.substring(at + 1);
            Hashtable<String, String> env = new Hashtable<>();
            env.put("java.naming.factory.initial", "com.sun.jndi.dns.DnsContextFactory");
            DirContext ctx = new InitialDirContext(env);
            Attributes attrs = ctx.getAttributes("dns:/" + domain, new String[]{"MX"});
            ctx.close();
            return attrs.get("MX") != null;
        } catch (Exception e) {
            return true; // if DNS lookup itself fails, attempt the send
        }
    }

    private String buildHtml(String icon, String accentColor, String type, String title, String message) {
        String typeLabel = type.replace("_", " ");
        return "<!DOCTYPE html>" +
            "<html><head><meta charset='UTF-8'>" +
            "<meta name='viewport' content='width=device-width,initial-scale=1'>" +
            "<style>" +
            "body{margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif}" +
            ".wrap{max-width:580px;margin:40px auto;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.5)}" +
            ".header{background:" + accentColor + ";padding:28px 32px;text-align:center}" +
            ".header h1{color:#fff;margin:0;font-size:22px;letter-spacing:.5px}" +
            ".header .sub{color:rgba(255,255,255,.8);font-size:13px;margin-top:4px}" +
            ".body{background:#1e293b;padding:32px}" +
            ".badge{display:inline-block;background:#0f172a;color:#94a3b8;border:1px solid #334155;" +
            "padding:4px 14px;border-radius:20px;font-size:11px;letter-spacing:.8px;" +
            "text-transform:uppercase;margin-bottom:20px}" +
            ".notif-title{color:#f1f5f9;font-size:20px;font-weight:700;margin:0 0 14px}" +
            ".notif-msg{color:#94a3b8;font-size:15px;line-height:1.7;margin:0}" +
            ".divider{border:none;border-top:1px solid #334155;margin:28px 0}" +
            ".cta{text-align:center;padding:0 0 8px}" +
            ".cta a{display:inline-block;background:" + accentColor + ";color:#fff;text-decoration:none;" +
            "font-weight:600;font-size:14px;padding:12px 28px;border-radius:10px}" +
            ".footer{background:#0f172a;padding:20px 32px;text-align:center;color:#475569;font-size:12px;line-height:1.6}" +
            "</style></head><body>" +
            "<div class='wrap'>" +
            "<div class='header'><h1>" + icon + " Courtly</h1>" +
            "<div class='sub'>Sports Court Booking Platform</div></div>" +
            "<div class='body'>" +
            "<div class='badge'>" + typeLabel + "</div>" +
            "<p class='notif-title'>" + escapeHtml(title) + "</p>" +
            "<p class='notif-msg'>" + escapeHtml(message) + "</p>" +
            "<hr class='divider'>" +
            "<div class='cta'><a href='http://localhost:5500/dashboard.html'>Open Courtly →</a></div>" +
            "</div>" +
            "<div class='footer'>You're receiving this because you have an active Courtly account.<br>" +
            "&copy; 2026 Courtly &mdash; All rights reserved.</div>" +
            "</div></body></html>";
    }

    private String escapeHtml(String text) {
        if (text == null) return "";
        return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
