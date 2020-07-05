import React, {Fragment, useState, useCallback, useEffect} from 'react';
import {cursor} from '@airtable/blocks';
import {ViewType} from '@airtable/blocks/models';
import {
    initializeBlock,
    registerRecordActionDataCallback,
    useBase,
    useRecordById,
    useLoadable,
    useSettingsButton,
    useWatchable,
    Box,
    Dialog,
    Heading,
    Link,
    Text,
    TextButton,
} from '@airtable/blocks/ui';

import {useSettings} from './settings';
import SettingsForm from './SettingsForm';
import EngineRoomCore from './EngineRoomCore.js';

// How this block chooses a preview to show:
//
// Without a specified Table & Field:
//
//  - When the user selects a cell in grid view and the field's content is
//    a supported preview URL, the block uses this URL to construct an embed
//    URL and inserts this URL into an iframe.
//
// To Specify a Table & Field:
//
//  - The user may use "Settings" to toggle a specified table and specified
//    field constraint. If the constraint switch is set to "Yes",he user must
//    set a specified table and specified field for URL previews.
//
// With a specified table & specified field:
//
//  - When the user selects a cell in grid view and the active table matches
//    the specified table or when the user opens a record from a button field
//    in the specified table:
//    The block looks in the selected record for the
//    specified field containing a supported URL (e.g. https://www.youtube.com/watch?v=KYz2wyBy3kc),
//    and uses this URL to construct an embed URL and inserts this URL into
//    an iframe.
//
function EngineRoom() {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    useSettingsButton(() => setIsSettingsOpen(!isSettingsOpen));

    const {
        isValid,
        settings: {isEnforced, urlTable},
    } = useSettings();

    // Caches the currently selected record and field in state. If the user
    // selects a record and a preview appears, and then the user de-selects the
    // record (but does not select another), the preview will remain. This is
    // useful when, for example, the user resizes the blocks pane.
    const [selectedRecordId, setSelectedRecordId] = useState(null);
    const [selectedFieldId, setSelectedFieldId] = useState(null);

    const [recordActionErrorMessage, setRecordActionErrorMessage] = useState('');

    // cursor.selectedRecordIds and selectedFieldIds aren't loaded by default,
    // so we need to load them explicitly with the useLoadable hook. The rest of
    // the code in the component will not run until they are loaded.
    useLoadable(cursor);

    // Update the selectedRecordId and selectedFieldId state when the selected
    // record or field change.
    useWatchable(cursor, ['selectedRecordIds', 'selectedFieldIds'], () => {
        // If the update was triggered by a record being de-selected,
        // the current selectedRecordId will be retained.  This is
        // what enables the caching described above.
        if (cursor.selectedRecordIds.length > 0) {
            // There might be multiple selected records. We'll use the first
            // one.
            setSelectedRecordId(cursor.selectedRecordIds[0]);
        }
        if (cursor.selectedFieldIds.length > 0) {
            // There might be multiple selected fields. We'll use the first
            // one.
            setSelectedFieldId(cursor.selectedFieldIds[0]);
        }
    });

    // Close the record action error dialog whenever settings are opened or the selected record
    // is updated. (This means you don't have to close the modal to see the settings, or when
    // you've opened a different record.)
    useEffect(() => {
        setRecordActionErrorMessage('');
    }, [isSettingsOpen, selectedRecordId]);

    // Register a callback to be called whenever a record action occurs (via button field)
    // useCallback is used to memoize the callback, to avoid having to register/unregister
    // it unnecessarily.
    const onRecordAction = useCallback(
        data => {
            // Ignore the event if settings are already open.
            // This means we can assume settings are valid (since we force settings to be open if
            // they are invalid).
            if (!isSettingsOpen) {
                if (isEnforced) {
                    if (data.tableId === urlTable.id) {
                        setSelectedRecordId(data.recordId);
                    } else {
                        // Record is from a mismatching table.
                        setRecordActionErrorMessage(
                            `This block is set up to preview URLs using records from the "${urlTable.name}" table, but was opened from a different table.`,
                        );
                    }
                } else {
                    // Preview is not supported in this case, as we wouldn't know what field to preview.
                    // Show a dialog to the user instead.
                    setRecordActionErrorMessage(
                        'You must enable "Use a specific field for previews" to preview URLs with a button field.',
                    );
                }
            }
        },
        [isSettingsOpen, isEnforced, urlTable],
    );
    useEffect(() => {
        // Return the unsubscribe function to ensure we clean up the handler.
        return registerRecordActionDataCallback(onRecordAction);
    }, [onRecordAction]);

    // This watch deletes the cached selectedRecordId and selectedFieldId when
    // the user moves to a new table or view. This prevents the following
    // scenario: User selects a record that contains a preview url. The preview appears.
    // User switches to a different table. The preview disappears. The user
    // switches back to the original table. Weirdly, the previously viewed preview
    // reappears, even though no record is selected.
    useWatchable(cursor, ['activeTableId', 'activeViewId'], () => {
        setSelectedRecordId(null);
        setSelectedFieldId(null);
    });

    const base = useBase();
    const activeTable = base.getTableByIdIfExists(cursor.activeTableId);

    useEffect(() => {
        // Display the settings form if the settings aren't valid.
        if (!isValid && !isSettingsOpen) {
            setIsSettingsOpen(true);
        }
    }, [isValid, isSettingsOpen]);

    // activeTable is briefly null when switching to a newly created table.
    if (!activeTable) {
        return null;
    }

    return (
        <Box>
            {isSettingsOpen ? (
                <SettingsForm setIsSettingsOpen={setIsSettingsOpen} />
            ) : (
                <RecordPreviewWithDialog
                    activeTable={activeTable}
                    selectedRecordId={selectedRecordId}
                    selectedFieldId={selectedFieldId}
                    setIsSettingsOpen={setIsSettingsOpen}
                />
            )}
            {recordActionErrorMessage && (
                <Dialog onClose={() => setRecordActionErrorMessage('')} maxWidth={400}>
                    <Dialog.CloseButton />
                    <Heading size="small">Can&apos;t preview URL</Heading>
                    <Text variant="paragraph" marginBottom={0}>
                        {recordActionErrorMessage}
                    </Text>
                </Dialog>
            )}
        </Box>
    );
}

// Shows a preview, or a dialog that displays information about what
// kind of services (URLs) are supported by this block.
function RecordPreviewWithDialog({
    activeTable,
    selectedRecordId,
    selectedFieldId,
    setIsSettingsOpen,
}) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Close the dialog when the selected record is changed.
    // The new record might have a preview, so we don't want to hide it behind this dialog.
    useEffect(() => {
        setIsDialogOpen(false);
    }, [selectedRecordId]);

    return (
        <Fragment>
            <Box
                position="absolute"
                top={0}
                left={0}
                right={0}
                bottom={0}
                display="flex"
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
            >
                <RecordPreview
                    activeTable={activeTable}
                    selectedRecordId={selectedRecordId}
                    selectedFieldId={selectedFieldId}
                    setIsDialogOpen={setIsDialogOpen}
                    setIsSettingsOpen={setIsSettingsOpen}
                />
            </Box>
            {isDialogOpen && (
                <Dialog onClose={() => setIsDialogOpen(false)} maxWidth={400}>
                    <Dialog.CloseButton />
                    <Heading size="small">Supported services</Heading>
                    <Text marginTop={2}>Previews are supported for these services:</Text>
                    <Text marginTop={2}>
                        <Link
                            href="https://support.airtable.com/hc/en-us/articles/205752117-Creating-a-base-share-link-or-a-view-share-link"
                            target="_blank"
                        >
                            Airtable share links
                        </Link>
                        , Figma, SoundCloud, Spotify, Vimeo, YouTube
                    </Text>
                    <Link
                        marginTop={2}
                        href="https://airtable.com/shrQSwIety6rqfJZX"
                        target="_blank"
                    >
                        Request a new service
                    </Link>
                </Dialog>
            )}
        </Fragment>
    );
}

// Shows a preview, or a message about what the user should do to see a preview.
function RecordPreview({
    activeTable,
    selectedRecordId,
    selectedFieldId,
    setIsDialogOpen,
    setIsSettingsOpen,
}) {
    const {
        settings: {isEnforced, urlField, urlTable},
    } = useSettings();

    const table = (isEnforced && urlTable) || activeTable;

    // We use getFieldByIdIfExists because the field might be deleted.
    const selectedField = selectedFieldId ? table.getFieldByIdIfExists(selectedFieldId) : null;
    // When using a specific field for previews is enabled and that field exists,
    // use the selectedField
    const previewField = (isEnforced && urlField) || selectedField;
    // Triggers a re-render if the record changes. Preview URL cell value
    // might have changed, or record might have been deleted.
    const selectedRecord = useRecordById(table, selectedRecordId ? selectedRecordId : '', {
        fields: [previewField],
    });

    // Triggers a re-render if the user switches table or view.
    // RecordPreview may now need to render a preview, or render nothing at all.
    useWatchable(cursor, ['activeTableId', 'activeViewId']);

    // This button is re-used in two states so it's pulled out in a constant here.
    const viewSupportedURLsButton = (
        <TextButton size="small" marginTop={3} onClick={() => setIsDialogOpen(true)}>
            View supported URLs
        </TextButton>
    );

    if (
        // If there is/was a specified table enforced, but the cursor
        // is not presently in the specified table, display a message to the user.
        // Exception: selected record is from the specified table (has been opened
        // via button field or other means while cursor is on a different table.)
        isEnforced &&
        cursor.activeTableId !== table.id &&
        !(selectedRecord && selectedRecord.parentTable.id === table.id)
    ) {
        return (
            <Fragment>
                <Text paddingX={3}>Switch to the “{table.name}” table to see previews.</Text>
                <TextButton size="small" marginTop={3} onClick={() => setIsSettingsOpen(true)}>
                    Settings
                </TextButton>
            </Fragment>
        );
    } else if (
        // activeViewId is briefly null when switching views
        selectedRecord === null &&
        (cursor.activeViewId === null ||
            table.getViewById(cursor.activeViewId).type !== ViewType.GRID)
    ) {
        return <Text>Switch to a grid view to see previews</Text>;
    } else if (
        // selectedRecord will be null on block initialization, after
        // the user switches table or view, or if it was deleted.
        selectedRecord === null ||
        // The preview field may have been deleted.
        previewField === null
    ) {
        return (
            // <Fragment>
            //     <Text>Select a cell to see a preview</Text>
            //     {viewSupportedURLsButton}
            // </Fragment>
            <EngineRoomCore src="https://models.babylonjs.com/Chair/Chair.obj"></EngineRoomCore>
        );
    } else {
        // Using getCellValueAsString guarantees we get a string back. If
        // we use getCellValue, we might get back numbers, booleans, or
        // arrays depending on the field type.
        const cellValue = selectedRecord.getCellValue(previewField);
        if (!cellValue) {
            return (
                <Fragment>
                    <Text>The “{previewField.name}” field is empty</Text>
                    {viewSupportedURLsButton}
                </Fragment>
            );
        } else {
            const previewUrl = get3DAssetURL(cellValue);


            // In this case, the FIELD_NAME field of the currently selected
            // record either contains no URL, or contains a that cannot be
            // resolved to a supported preview.
            if (!previewUrl) {
                return (
                    <Fragment>
                        <Text>No preview</Text>
                        {viewSupportedURLsButton}
                    </Fragment>
                );
            } else {
                return (
                    <EngineRoomCore src={previewUrl}></EngineRoomCore>
                );
            }
        }
    }
}

// Returns a URL if the cell contains:
// 1. a URL string that matches the supported filetypes
// 2. an attachment to a file that is one of the supported file types
// Supported file types: gltf, glb and obj
const get3DAssetURL = (item) => {
    if (!item) {
        return null;
    }

    const fileTypesRegex = {
                        "gltf": /\.gltf$/,
                        "glb": /\.glb$/,
                        "obj": /\.obj$/
                    }

    // Check if url string is pointing to one of the supported file types
    const isSupportedFileType = (url) => {
        try {
            for (const fileType of Object.keys(fileTypesRegex)) {
                if(url.match(fileTypesRegex[fileType])) {
                    return true;
                }
            }
            return false;
        } catch (error) {
            return false
        }
    }

    // If cell contains an airtable attachment then it should be an array containing objects
    // which have a `url` property. Only first attachment is previewed
    if (item[0] && item[0].url) {
        item = item[0]

        // Check if the airtable attachment is one of the supported file types
        if (isSupportedFileType(item.url)) {
            return item.url
        }
        return null;
    }
    // If its not an Airtable attachment then check if its a URL string.
    else {
        try {
            // Fails if `item` is not a valid url string
            new URL(item)
            if (isSupportedFileType(item)) {
                return item
            }
            return null
        } catch (error) {
            return null
        }
    }
}

initializeBlock(() => <EngineRoom />);
