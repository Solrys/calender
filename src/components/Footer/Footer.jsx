import Link from "next/link";
import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.paddingGlobal}>
        <div className={styles.containerLarge}>
          <div className={styles.paddingSectionMedium}>
            <div className={styles.footerMainGridNote}>
              <Link href="index.html" className={styles.footerNoteLogo}>
                <img
                  src="images/Spaces.logo.png"
                  alt=""
                  className={styles.imageCover}
                />
              </Link>
              <div className={styles.footerLinkWrapper}>
                <div className={styles.footerLinkItem}>
                  <Link
                    href="about-the-spaces.html"
                    className={styles.footerLink}
                  >
                    The Spaces
                  </Link>
                  <Link
                    href="/about-the-spaces/#thelab"
                    className={styles.footerLink}
                  >
                    The Lab
                  </Link>
                  <Link
                    href="/about-the-spaces/#extension"
                    className={styles.footerLink}
                  >
                    The Extension
                  </Link>
                  <Link
                    href="/about-the-spaces/#ground"
                    className={styles.footerLink}
                  >
                    The Ground
                  </Link>
                  <Link href="the-pull.html" className={styles.footerLink}>
                    The Pull
                  </Link>
                </div>
                <div className={styles.footerLinkItem}>
                  <Link href="about.html" className={styles.footerLink}>
                    About Us
                  </Link>
                  <Link href="contact.html" className={styles.footerLink}>
                    Contact Us
                  </Link>
                  <Link
                    href="terms-and-condition.html"
                    className={styles.footerLink}
                  >
                    Terms &amp; Conditions
                  </Link>
                  <Link href="faq.html" className={styles.footerLink}>
                    FAQ
                  </Link>
                </div>
              </div>
              <div className={styles.footerSubWrap}>
                <div className={styles.footerFormBlock}>
                  <form
                    id="wf-form-Footer-Email"
                    name="wf-form-Footer-Email"
                    method="get"
                    className={styles.footerForm}
                  >
                    <label htmlFor="email-2">LET’S STAY IN TOUCH</label>
                    <div className={styles.flexInputSub}>
                      <input
                        className={styles.formInput}
                        maxLength="256"
                        name="email-2"
                        placeholder="Enter your email"
                        type="email"
                        id="email-2"
                        required
                      />
                      <input
                        type="submit"
                        className={styles.submitButton}
                        value="ok"
                      />
                    </div>
                  </form>
                  <div className="w-form-done">
                    <div>Thank you! Your submission has been received!</div>
                  </div>
                  <div className="w-form-fail">
                    <div>
                      Oops! Something went wrong while submitting the form.
                    </div>
                  </div>
                </div>
                <div className={styles.footerFollowWrapper}>
                  <div>Follow Us </div>
                  <div className={styles.followSocialsWrapper}>
                    <a
                      href="https://www.instagram.com/bookthespaces/"
                      target="_blank"
                      className={styles.textLinkFollow}
                    >
                      Instagram
                    </a>
                    <a
                      href="https://www.facebook.com/bookthespaces?mibextid=LQQJ4d&amp;rdid=Qmmjt3s1WhDjcFVg&amp;share_url=https%3A%2F%2Fwww.facebook.com%2Fshare%2F14DWoGrfpRf%2F%3Fmibextid%3DLQQJ4d#"
                      target="_blank"
                      className={styles.textLinkFollow}
                    >
                      Facebook
                    </a>
                    <a
                      href="https://in.pinterest.com/BOOKTHESPACES/"
                      target="_blank"
                      className={styles.textLinkFollow}
                    >
                      Pinterest
                    </a>
                  </div>
                </div>
                <div className="margin-top margin-medium">
                  <div className={styles.textCopyrightCaption}>
                    © 2025. All Rights Reserved To The Spaces
                  </div>
                </div>
                <div className={styles.textCopyrightCaption}>
                  <a href="https://solrys.co/" target="_blank">
                    Webdesign by @solrys.co
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
