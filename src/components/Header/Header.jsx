import Link from "next/link";
import styles from "./Header.module.css";

export default function Header() {
  return (
    <header className={styles.header}>
      <div
        className={styles.navbar3_component}
        data-animation="over-left"
        data-w-id="ef8c5db5-8679-ee9f-594c-6f4030e8dcae"
        role="banner"
        data-duration="400"
      >
        <div className={styles.navbar3_container}>
          <div className={styles.navbar3_menu_button}>
            <div className={styles.menu_icon_wrap}>
              <div className={styles.menu}>Menu</div>
              <div className={styles.close}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  fill="#000000"
                  viewBox="0 0 256 256"
                >
                  <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path>
                </svg>
              </div>
            </div>
          </div>
          <nav role="navigation" className={styles.navbar3_menu}>
            <div className={styles.flex}>
              <div className={styles.div_block}>
                <div className={styles.nav_dropdown_main}>
                  <div
                    data-w-id="ef8c5db5-8679-ee9f-594c-6f4030e8dcbc"
                    className={styles.link_nav_dropdown_toggle}
                  >
                    <Link href="#" className={styles.navbar3_link}>
                      The Spaces
                    </Link>
                    <div className={styles.icon_toggle}>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        fill="currentColor"
                        viewBox="0 0 256 256"
                      >
                        <path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z"></path>
                      </svg>
                    </div>
                  </div>
                  <div className={styles.dropdown_content_wrap}>
                    <div className={styles.nav_sub_wrap}>
                      <Link
                        href="/about-the-spaces/#thelab"
                        className={styles.navbar3_link}
                      >
                        The Lab
                      </Link>
                      <Link
                        href="/about-the-spaces/#extension"
                        className={styles.navbar3_link}
                      >
                        The Extension
                      </Link>
                      <Link
                        href="/about-the-spaces/#ground"
                        className={styles.navbar3_link}
                      >
                        The Ground
                      </Link>
                      <Link
                        href="/about-the-spaces/#the-podcast-Room"
                        className={styles.navbar3_link}
                      >
                        The Podcast Room
                      </Link>
                    </div>
                  </div>
                </div>
                <Link href="book-an-event.html" className={styles.navbar3_link}>
                  Book An Event
                </Link>
                <Link href="the-pull.html" className={styles.navbar3_link}>
                  The Pull
                </Link>
                <Link href="our-props.html" className={styles.navbar3_link}>
                  The Props
                </Link>
                <Link href="services.html" className={styles.navbar3_link}>
                  Services
                </Link>
                <Link href="about.html" className={styles.navbar3_link}>
                  About Us
                </Link>
                <Link href="contact.html" className={styles.navbar3_link}>
                  Contact Us
                </Link>
                <Link href="index.html" className={styles.navbar3_link}>
                  Home
                </Link>
              </div>
              <div className={styles.brand_nav}>
                <img
                  sizes="100vw"
                  srcSet="images/Spaces.logo-p-500.png 500w, images/Spaces.logo-p-800.png 800w, images/Spaces.logo-p-1080.png 1080w, images/Spaces.logo.png 1280w"
                  alt=""
                  src="images/Spaces.logo.png"
                  className={styles.image_cover}
                />
              </div>
            </div>
          </nav>
          <Link href="index.html" className={styles.navbar3_logo_link}>
            <span>
              <img
                src="images/Untitled-1-Recovered.png"
                alt=""
                className={`${styles.image_cover} ${styles.navbar3_logo_black}`}
              />
              <img
                src="images/final.TheSpaces.logo.png"
                alt=""
                className={`${styles.image_cover} ${styles.navbar3_logo_white}`}
              />
            </span>
          </Link>
          <div className={styles.menu_sub}>
            <Link
              href="booking.html"
              className={`${styles.navbar3_link} ${styles.cart}`}
            >
              Cart
            </Link>
          </div>
        </div>
        <div className={styles.nav_bg}></div>
      </div>
    </header>
  );
}
