const nodemailer = require("nodemailer");
const pug = require("pug");
const htmlToText = require("html-to-text");

module.exports = class Email {
  constructor(user, others) {
    console.log("other:", others);
    this.to = user?.firstName + " " + user?.lastName + " " + `<${user?.email}>`;
    this.firstName = user?.firstName;
    this.url = others?.url;
    this.otp = others?.otp;
    this.unsubscribeUrl = others?.unSubscribeUrl;
    this.from = `Exotiride <${process.env.EMAIL_FROM}>`;
  }

  newTransport() {
    if (process.env.NODE_ENV === "production") {
      // Sendgrid
      //   return nodemailer.createTransport({
      //     service: 'SendGrid',
      //     auth: {
      //       user: process.env.SENDGRID_USERNAME,
      //       pass: process.env.SENDGRID_PASSWORD
      //     }
      //   });
      // }
      // FR
      return nodemailer.createTransport({
        host: process.env.EXOTIRIDE_HOST,
        port: process.env.EXOTIRIDE_PORT,
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.FR_USERNAME,
          pass: process.env.FR_PASSWORD,
        },
      });
    }

    return nodemailer.createTransport({
      host: process.env.EMAILTRAP_HOST,
      port: process.env.EMAILTRAP_PORT,
      auth: {
        user: process.env.EMAILTRAP_USERNAME,
        pass: process.env.EMAILTRAP_PASSWORD,
      },
    });
  }

  // Send the actual email
  async send(template, subject) {
    // 1) Render HTML based on a pug template
    const html = pug.renderFile(`${__dirname}/../views/email/${template}.pug`, {
      firstName: this.firstName,
      url: this.url,
      otp: this.otp,
      unsubscribeUrl: this.unsubscribeUrl,
      subject,
    });

    // 2) Define email options
    const mailOptions = {
      from: this.from,
      to: this.to,
      subject,
      html,
      text: htmlToText.fromString(html),
    };

    // 3) Create a transport and send email
    await this.newTransport().sendMail(mailOptions);
  }

  async sendWelcome() {
    await this.send("welcome", "Welcome to Exotiride!");
  }

  async sendEmailOTP() {
    await this.send("emailOTP", "Our Verification Code for Exotiride");
  }

  async sendPasswordReset() {
    await this.send(
      "passwordReset",
      "Your password reset token (valid for only 10 minutes)"
    );
  }

  async sendPasswordResetSuccess() {
    await this.send(
      "passwordResetSuccess",
      "Your password reset successfully changed"
    );
  }

  async sendEmailResetSuccess() {
    await this.send(
      "emailResetSuccess",
      "Your email reset successfully changed"
    );
  }

  async sendEmailVerifySuccess() {
    await this.send("emailVerifySuccess", "Email successfully verified!");
  }

  async sendEmailBookingAccepted() {
    await this.send("emailBookingAccepted", "Your booking as been accepted!");
  }

  async sendEmailBookingDeclined() {
    await this.send("emailBookingDeclined", "Your booking as been declined!");
  }

  async sendEmailEventInvite() {
    await this.send("eventInvitation", "Your Event Invites as been sent!");
  }

  async sendProfileAccepted() {
    await this.send(
      "profileAccepted",
      "Your profile was accepted! Welcome to Exotiride"
    );
  }

  async sendProfileRejected() {
    await this.send("profileRejected", "Sorry, your profile was not accepted");
  }
};
