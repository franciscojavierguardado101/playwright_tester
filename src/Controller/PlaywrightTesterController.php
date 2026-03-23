<?php

namespace Drupal\playwright_tester\Controller;

use Drupal\Core\Controller\ControllerBase;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Controller for Francisco Guardado Playwright Tester.
 */
class PlaywrightTesterController extends ControllerBase {

  /**
   * Main page.
   */
  public function page() {
    $db = \Drupal::database();
    $results = $db->select('playwright_tester_files', 'p')
      ->fields('p', ['id', 'filename', 'created'])
      ->orderBy('created', 'DESC')
      ->execute()
      ->fetchAll();

    // Convert to arrays for Twig.
    $files = [];
    foreach ($results as $row) {
      $files[] = [
        'id'       => $row->id,
        'filename' => $row->filename,
        'created'  => $row->created,
      ];
    }

    return [
      '#theme'    => 'playwright_tester_page',
      '#files'    => $files,
      '#attached' => [
        'library' => ['playwright_tester/playwright_tester'],
      ],
      '#cache'    => ['max-age' => 0],
    ];
  }

  /**
   * Save a spec file to the database.
   */
  public function save(Request $request) {
    $data = json_decode($request->getContent(), TRUE);

    if (empty($data['filename']) || empty($data['content'])) {
      return new JsonResponse(['error' => 'Missing filename or content.'], 400);
    }

    $db = \Drupal::database();
    $id = $db->insert('playwright_tester_files')
      ->fields([
        'filename' => $data['filename'],
        'content'  => $data['content'],
        'created'  => \Drupal::time()->getRequestTime(),
      ])
      ->execute();

    return new JsonResponse(['success' => TRUE, 'id' => $id]);
  }

  /**
   * Get a spec file by ID.
   */
  public function get($id) {
    $db = \Drupal::database();
    $file = $db->select('playwright_tester_files', 'p')
      ->fields('p')
      ->condition('id', $id)
      ->execute()
      ->fetchObject();

    if (!$file) {
      return new JsonResponse(['error' => 'File not found.'], 404);
    }

    return new JsonResponse([
      'id'       => $file->id,
      'filename' => $file->filename,
      'content'  => $file->content,
      'created'  => $file->created,
    ]);
  }

}
