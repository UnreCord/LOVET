<?php
/**
 * Tema LOVET: la portada es la misma pagina de index.html, con sus estilos,
 * su script y sus imagenes servidos desde la carpeta del tema.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'LOVET_VERSION', '1.1.0' );

add_action( 'after_setup_theme', function () {
	add_theme_support( 'automatic-feed-links' );
	add_theme_support( 'html5', array( 'script', 'style' ) );
} );

add_action( 'wp_enqueue_scripts', function () {
	wp_enqueue_style(
		'lovet-fuentes',
		'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,400..800&family=Instrument+Serif&display=swap',
		array(),
		null
	);
	wp_enqueue_style( 'lovet', get_stylesheet_uri(), array( 'lovet-fuentes' ), LOVET_VERSION );

	if ( ! is_front_page() ) {
		return;
	}

	// mapa de puntos de venta
	wp_enqueue_style( 'maplibre', 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css', array(), null );
	wp_enqueue_script( 'maplibre', 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js', array(), null, array( 'strategy' => 'defer' ) );

	wp_enqueue_script( 'lovet', get_theme_file_uri( 'main.js' ), array(), LOVET_VERSION, true );
	// main.js busca sus imagenes en la carpeta del tema
	wp_add_inline_script(
		'lovet',
		'window.LOVET_BASE = ' . wp_json_encode( trailingslashit( get_template_directory_uri() ) ) . ';',
		'before'
	);

	// la portada no usa bloques: sin estilos de bloques ni emojis que choquen con el diseño
	wp_dequeue_style( 'wp-block-library' );
	wp_dequeue_style( 'wp-block-library-theme' );
	wp_dequeue_style( 'classic-theme-styles' );
	wp_dequeue_style( 'global-styles' );
}, 20 );

add_action( 'init', function () {
	remove_action( 'wp_head', 'print_emoji_detection_script', 7 );
	remove_action( 'wp_print_styles', 'print_emoji_styles' );
} );

// la portada ocupa toda la pantalla y se mueve por secciones: la barra de administracion la tapaba
add_filter( 'show_admin_bar', function ( $show ) {
	return is_front_page() ? false : $show;
} );

// icono de la pestaña si el sitio no tiene uno propio (Apariencia > Personalizar > Identidad del sitio)
add_action( 'wp_head', function () {
	if ( ! has_site_icon() ) {
		echo '<link rel="icon" href="' . esc_url( get_theme_file_uri( 'assets/logo-lovet.png' ) ) . '">' . "\n";
	}
} );
