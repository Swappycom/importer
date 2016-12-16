/**
 * @license Copyright (c) 2003-2013, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.html or http://ckeditor.com/license
 */



CKEDITOR.editorConfig = function (config) {
    // Define changes to default configuration here.
    // For the complete reference:
    // http://docs.ckeditor.com/#!/api/CKEDITOR.config

    // The toolbar groups arrangement, optimized for a single toolbar row.

    config.toolbar = 'MyToolbar';
    config.toolbar_MyToolbar =
        [


            {
                name: 'basicstyles',
                items: ['Bold', 'Italic', 'RemoveFormat']
            },
            {
                name: 'paragraph',
                items: ['NumberedList', 'BulletedList', '-', 'Outdent', 'Indent',
                    '-', 'JustifyLeft', 'JustifyCenter', 'JustifyBlock']
            },
            {
                name: 'links',
                items: ['Link']
            },

            {
                name: 'styles',
                items: ['Styles', 'FontSize']
            },
            {

                name: 'tools',
                items: ['Maximize']
            },
            {
                name: 'document',
                items: ['Source']
            }
        ];


    // The default plugins included in the basic setup define some buttons that
    // we don't want too have in a basic editor. We remove them here.
    config.removeButtons = 'Cut,Copy,Paste,Undo,Redo,Anchor,Underline,Strike,Subscript,Superscript';
    config.allowedContent = true;
    // Let's have it basic on dialogs as well.
    config.removeDialogTabs = 'link:advanced';


};

CKEDITOR.stylesSet.add('default', [
// Block Styles
    {
        name: 'TITLE',
        element: 'h2',
        styles: {
            color: '#4e4d4d'
        }
    },
    {
        name: 'SUBTITLE',
        element: 'h3'
    },
    {
        name: 'Paragraph',
        element: 'p'
    }
]);