<?php
/**
 * Cualquier pagina que no sea la portada (entradas, politica de privacidad...):
 * el contenido de WordPress con la barra y el pie de LOVET.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta name="theme-color" content="#00433c">
	<?php wp_head(); ?>
</head>
<body <?php body_class( 'lovet-interior' ); ?>>
<?php wp_body_open(); ?>
	<header class="topbar lovet-interior__bar">
		<a class="topbar__logo" href="<?php echo esc_url( home_url( '/' ) ); ?>" aria-label="LOVET, volver al inicio">
			<img class="logo-light" src="<?php echo esc_url( get_theme_file_uri( 'assets/logo-wordmark.png' ) ); ?>" alt="" width="1200" height="391">
		</a>
		<a class="topbar__cta" href="<?php echo esc_url( home_url( '/#donde' ) ); ?>">Dónde comprar</a>
	</header>

	<main class="lovet-interior__main">
		<?php if ( have_posts() ) : ?>
			<?php while ( have_posts() ) : the_post(); ?>
				<article <?php post_class( 'lovet-interior__entry' ); ?>>
					<h1 class="display"><?php the_title(); ?></h1>
					<div class="lovet-interior__content"><?php the_content(); ?></div>
				</article>
			<?php endwhile; ?>
			<?php the_posts_pagination(); ?>
		<?php else : ?>
			<article class="lovet-interior__entry">
				<h1 class="display">No encontramos esta página.</h1>
				<p><a class="btn btn--yellow" href="<?php echo esc_url( home_url( '/' ) ); ?>">Volver al inicio</a></p>
			</article>
		<?php endif; ?>
	</main>

	<footer class="footer lovet-interior__footer">
		<img src="<?php echo esc_url( get_theme_file_uri( 'assets/logo-wordmark.png' ) ); ?>" alt="LOVET" width="1200" height="391" loading="lazy">
		<p>© <?php echo esc_html( gmdate( 'Y' ) ); ?> LOVET</p>
	</footer>
<?php wp_footer(); ?>
</body>
</html>
