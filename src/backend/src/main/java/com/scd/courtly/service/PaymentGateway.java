package com.scd.courtly.service;

import com.scd.courtly.exception.BusinessException;
import com.stripe.exception.StripeException;
import com.stripe.model.Charge;
import com.stripe.model.PaymentIntent;
import com.stripe.model.Refund;
import com.stripe.net.RequestOptions;
import com.stripe.param.PaymentIntentCreateParams;
import com.stripe.param.PaymentIntentRetrieveParams;
import com.stripe.param.RefundCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * The only class that talks to Stripe (class diagram: PaymentGateway).
 * Everything else works with the simple {@link GatewayIntent} record, which also
 * lets tests replace this class without calling the real Stripe API.
 */
@Component
public class PaymentGateway {

    public static final String CURRENCY = "pkr";

    /** What the rest of the app needs to know about a Stripe PaymentIntent. */
    public record GatewayIntent(
        String id,
        String clientSecret,
        String status,          // e.g. requires_payment_method, succeeded
        long amountMinor,       // paisa (PKR x 100)
        String bookingID,       // from metadata
        String cardLast4,       // null until a card has been charged
        String cardBrand
    ) {
        public boolean succeeded() { return "succeeded".equals(status); }
    }

    private final String secretKey;

    public PaymentGateway(@Value("${stripe.api.secret.key:}") String secretKey) {
        this.secretKey = secretKey;
    }

    /** Starts a card payment for a booking (DCD: processTransaction). */
    public GatewayIntent createIntent(String bookingID, long amountMinor) {
        PaymentIntentCreateParams params = PaymentIntentCreateParams.builder()
            .setAmount(amountMinor)
            .setCurrency(CURRENCY)
            .addPaymentMethodType("card")
            .putMetadata("bookingID", bookingID)
            .setDescription("Courtly booking " + bookingID)
            .build();
        try {
            return toIntent(PaymentIntent.create(params, options()));
        } catch (StripeException e) {
            throw providerError(e);
        }
    }

    /** Reads the current state of a payment from Stripe, including the card's last four digits. */
    public GatewayIntent retrieveIntent(String paymentIntentID) {
        PaymentIntentRetrieveParams params = PaymentIntentRetrieveParams.builder()
            .addExpand("latest_charge")
            .build();
        try {
            return toIntent(PaymentIntent.retrieve(paymentIntentID, params, options()));
        } catch (StripeException e) {
            throw providerError(e);
        }
    }

    /** Refunds a payment in full (DCD: issueRefund). */
    public boolean issueRefund(String paymentIntentID) {
        try {
            Refund refund = Refund.create(
                RefundCreateParams.builder().setPaymentIntent(paymentIntentID).build(), options());
            return !"failed".equals(refund.getStatus());
        } catch (StripeException e) {
            throw providerError(e);
        }
    }

    private RequestOptions options() {
        if (secretKey == null || secretKey.isBlank()) {
            throw new BusinessException("Online payments are not configured on this server",
                HttpStatus.SERVICE_UNAVAILABLE);
        }
        return RequestOptions.builder().setApiKey(secretKey).build();
    }

    private static GatewayIntent toIntent(PaymentIntent pi) {
        String last4 = null;
        String brand = null;
        Charge charge = pi.getLatestChargeObject();
        if (charge != null && charge.getPaymentMethodDetails() != null
                && charge.getPaymentMethodDetails().getCard() != null) {
            last4 = charge.getPaymentMethodDetails().getCard().getLast4();
            brand = charge.getPaymentMethodDetails().getCard().getBrand();
        }
        String bookingID = pi.getMetadata() != null ? pi.getMetadata().get("bookingID") : null;
        return new GatewayIntent(pi.getId(), pi.getClientSecret(), pi.getStatus(),
            pi.getAmount() != null ? pi.getAmount() : 0L, bookingID, last4, brand);
    }

    private static BusinessException providerError(StripeException e) {
        return new BusinessException("The payment provider rejected the request: " + e.getMessage(),
            HttpStatus.BAD_GATEWAY);
    }
}
